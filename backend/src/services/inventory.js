const Stock = require("../models/Stock");
const StockMovement = require("../models/StockMovement");

function summarizeInvoice(invoice) {
  const summary = new Map();
  const type = invoice.invoiceType || "sale";
  for (const item of invoice.items || []) {
    if (!item.productId) continue;
    const key = String(item.productId);
    const qty = Number(item.qty || 0);
    const unitPrice = Number(item.unitPrice || 0);
    if (!summary.has(key)) {
      summary.set(key, { purchaseQty: 0, purchaseCost: 0, saleQty: 0 });
    }
    const entry = summary.get(key);
    if (type === "purchase") {
      entry.purchaseQty += qty;
      entry.purchaseCost += qty * unitPrice;
    } else {
      entry.saleQty += qty;
    }
  }
  return summary;
}

async function getStockMap(companyId, branchId, productIds, session) {
  if (!productIds.length) return new Map();
  const stocks = await Stock.find({
    companyId,
    branchId,
    productId: { $in: productIds }
  }).session(session || null);
  const map = new Map();
  stocks.forEach((stock) => map.set(String(stock.productId), stock));
  return map;
}

function collectProductIds(...summaries) {
  const ids = new Set();
  summaries.forEach((summary) => {
    summary.forEach((_value, key) => ids.add(key));
  });
  return Array.from(ids);
}

function buildMovementLines(invoice, stockMap) {
  const type = invoice.invoiceType || "sale";
  const lines = [];
  for (const item of invoice.items || []) {
    if (!item.productId) continue;
    const qty = Number(item.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const stock = stockMap.get(String(item.productId));
    const unitCost = type === "purchase" ? Number(item.unitPrice || 0) : Number(stock?.avgCost || 0);
    const signedQty = type === "purchase" ? qty : -qty;
    lines.push({
      branchId: invoice.branchId,
      productId: item.productId,
      type,
      qty: signedQty,
      unitCost,
      totalCost: Math.abs(signedQty) * unitCost
    });
  }
  return lines;
}

async function applyInventoryDelta({
  companyId,
  branchId,
  oldSummary,
  newSummary,
  session
}) {
  if (!branchId) return { shortages: [] };

  const productIds = collectProductIds(oldSummary, newSummary);
  const stockMap = await getStockMap(companyId, branchId, productIds, session);
  const shortages = [];

  for (const productId of productIds) {
    const oldEntry = oldSummary.get(productId) || { purchaseQty: 0, purchaseCost: 0, saleQty: 0 };
    const newEntry = newSummary.get(productId) || { purchaseQty: 0, purchaseCost: 0, saleQty: 0 };
    const purchaseDeltaQty = newEntry.purchaseQty - oldEntry.purchaseQty;
    const purchaseDeltaCost = newEntry.purchaseCost - oldEntry.purchaseCost;
    const saleDeltaQty = newEntry.saleQty - oldEntry.saleQty;
    const net = purchaseDeltaQty - saleDeltaQty;

    const stock = stockMap.get(productId);
    const onHand = stock ? Number(stock.onHand || 0) : 0;
    if (net < 0 && onHand + net < 0) {
      shortages.push({
        productId,
        available: onHand,
        requested: Math.abs(net)
      });
    }
  }

  if (shortages.length > 0) {
    return { shortages };
  }

  for (const productId of productIds) {
    const oldEntry = oldSummary.get(productId) || { purchaseQty: 0, purchaseCost: 0, saleQty: 0 };
    const newEntry = newSummary.get(productId) || { purchaseQty: 0, purchaseCost: 0, saleQty: 0 };
    const purchaseDeltaQty = newEntry.purchaseQty - oldEntry.purchaseQty;
    const purchaseDeltaCost = newEntry.purchaseCost - oldEntry.purchaseCost;
    const saleDeltaQty = newEntry.saleQty - oldEntry.saleQty;

    let stock = stockMap.get(productId);
    if (!stock) {
      stock = new Stock({ companyId, branchId, productId, onHand: 0, avgCost: 0 });
      stockMap.set(productId, stock);
    }

    let currentOnHand = Number(stock.onHand || 0);
    const currentAvg = Number(stock.avgCost || 0);

    if (purchaseDeltaQty > 0) {
      const addedCost = purchaseDeltaCost > 0 ? purchaseDeltaCost : purchaseDeltaQty * currentAvg;
      const newOnHand = currentOnHand + purchaseDeltaQty;
      const newAvg = newOnHand > 0 ? (currentOnHand * currentAvg + addedCost) / newOnHand : 0;
      stock.avgCost = Number.isFinite(newAvg) ? newAvg : currentAvg;
      currentOnHand = newOnHand;
    } else if (purchaseDeltaQty < 0) {
      currentOnHand += purchaseDeltaQty;
    }

    if (saleDeltaQty !== 0) {
      currentOnHand -= saleDeltaQty;
    }

    stock.onHand = currentOnHand;
    await stock.save({ session });
  }

  return { shortages: [] };
}

async function applyInvoiceInventory({
  companyId,
  invoice,
  previousInvoice,
  session
}) {
  const invoiceBranch = invoice.branchId ? String(invoice.branchId) : null;
  const previousBranch = previousInvoice?.branchId ? String(previousInvoice.branchId) : null;
  const newSummary = summarizeInvoice(invoice);
  const oldSummary = previousInvoice ? summarizeInvoice(previousInvoice) : new Map();

  if (previousInvoice && previousBranch && invoiceBranch && previousBranch !== invoiceBranch) {
    const oldResult = await applyInventoryDelta({
      companyId,
      branchId: previousBranch,
      oldSummary,
      newSummary: new Map(),
      session
    });
    if (oldResult.shortages.length > 0) return oldResult;

    return applyInventoryDelta({
      companyId,
      branchId: invoiceBranch,
      oldSummary: new Map(),
      newSummary,
      session
    });
  }

  const branchId = invoiceBranch || previousBranch;
  if (!branchId) return { shortages: [] };
  return applyInventoryDelta({
    companyId,
    branchId,
    oldSummary,
    newSummary,
    session
  });
}

async function replaceInvoiceMovements({
  companyId,
  invoice,
  session
}) {
  if (!invoice.branchId) {
    await StockMovement.deleteMany(
      { companyId, sourceType: "invoice", sourceId: invoice._id },
      { session }
    );
    return;
  }

  const productIds = Array.from(
    new Set((invoice.items || []).filter((it) => it.productId).map((it) => String(it.productId)))
  );
  const stockMap = await getStockMap(companyId, invoice.branchId, productIds, session);
  const lines = buildMovementLines(invoice, stockMap);
  await StockMovement.deleteMany(
    { companyId, sourceType: "invoice", sourceId: invoice._id },
    { session }
  );
  if (lines.length === 0) return;

  const docs = lines.map((line) => ({
    companyId,
    branchId: invoice.branchId,
    productId: line.productId,
    type: line.type,
    qty: line.qty,
    unitCost: line.unitCost,
    totalCost: line.totalCost,
    sourceType: "invoice",
    sourceId: invoice._id,
    note: invoice.invoiceNo
  }));
  await StockMovement.insertMany(docs, { session });
}

module.exports = {
  summarizeInvoice,
  applyInvoiceInventory,
  replaceInvoiceMovements,
  getStockMap
};
