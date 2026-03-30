const express = require("express");
const { z } = require("zod");
const Sale = require("../models/Sale");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const Branch = require("../models/Branch");
const Customer = require("../models/Customer");
const TradeIn = require("../models/TradeIn");
const PhoneInventoryItem = require("../models/PhoneInventoryItem");
const ChangeLog = require("../models/ChangeLog");
const {
  ensureObjectId,
  nextNumber,
  parseOptionalDate,
  parseDateOrThrow,
  parseLimit,
  parsePage,
  buildItems,
  calcTotals,
  handleRouteError
} = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { applyInvoiceInventory, replaceInvoiceMovements } = require("../services/inventory");
const { buildSalesWorkbook } = require("../services/export");
const { resolveWorkspaceId, withWorkspaceScope } = require("../services/scope");
const { syncPhoneInventoryForSale } = require("../services/phoneInventorySync");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("sales"));

function mapSaleStatusToInvoiceStatus(status) {
  if (status === "cancelled") return "cancelled";
  if (status === "paid") return "paid";
  if (status === "partial") return "partial";
  return "sent";
}

async function upsertReceiptInvoiceForSale({ req, sale, session }) {
  const workspace = req.workspace;
  if (!workspace?.enabledModules?.includes("invoices")) return null;

  const invoicePatch = {
    companyId: sale.companyId,
    workspaceId: sale.workspaceId,
    userId: sale.userId,
    deviceId: sale.deviceId,
    customerId: sale.customerId || null,
    customerName: sale.customerName || "Walk-in",
    customerPhone: sale.customerPhone,
    customerTpin: sale.customerTpin,
    salespersonId: sale.salespersonId || null,
    tradeInId: sale.tradeInId || null,
    tradeInCredit: Number(sale.tradeInCredit || 0),
    branchId: sale.branchId || null,
    branchName: sale.branchName,
    invoiceType: "sale",
    issueDate: sale.issueDate || new Date(),
    dueDate: sale.issueDate || new Date(),
    status: mapSaleStatusToInvoiceStatus(sale.status),
    vatRate: sale.vatRate ?? 0,
    items: (sale.items || []).map((item) => ({
      productId: item.productId,
      productSku: item.productSku,
      productName: item.productName,
      description: item.description,
      qty: item.qty,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      lineTotal: item.lineTotal
    })),
    subtotal: sale.subtotal,
    vatAmount: sale.vatAmount,
    total: sale.total,
    amountPaid: sale.amountPaid,
    balance: sale.balance,
    sourceSaleId: sale._id,
    deletedAt: sale.deletedAt ? sale.deletedAt : null
  };

  let invoice = null;
  if (sale.receiptInvoiceId) {
    invoice = await Invoice.findOne({ _id: sale.receiptInvoiceId, companyId: req.user.companyId }).session(session);
    if (invoice) {
      Object.assign(invoice, invoicePatch);
      invoice.version = (invoice.version || 1) + 1;
      await invoice.save({ session });
      return invoice;
    }
  }

  const invoiceNo = await nextNumber("REC", Invoice, "invoiceNo", "^REC-");
  invoice = new Invoice({
    invoiceNo,
    ...invoicePatch,
    version: 1
  });
  await invoice.save({ session });

  sale.receiptInvoiceId = invoice._id;
  await sale.save({ session });
  return invoice;
}

const SaleCreateSchema = z.object({
  saleNo: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerTpin: z.string().optional(),
  salespersonId: z.string().optional(),
  tradeInId: z.string().optional(),
  branchId: z.string().optional(),
  issueDate: z.string().optional(),
  status: z.enum(["paid", "partial", "unpaid", "cancelled"]).optional(),
  amountPaid: z.number().min(0).optional(),
  vatRate: z.number().min(0).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        productSku: z.string().optional(),
        productName: z.string().optional(),
        phoneItemId: z.string().optional(),
        description: z.string().min(1),
        qty: z.number().nonnegative(),
        unitPrice: z.number().nonnegative(),
        discount: z.number().nonnegative().optional()
      })
    )
    .min(1)
});

const SaleUpdateSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerTpin: z.string().optional(),
  salespersonId: z.string().optional(),
  tradeInId: z.string().optional(),
  branchId: z.string().optional(),
  issueDate: z.string().optional(),
  status: z.enum(["paid", "partial", "unpaid", "cancelled"]).optional(),
  vatRate: z.number().min(0).optional(),
  amountPaid: z.number().min(0).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        productSku: z.string().optional(),
        productName: z.string().optional(),
        phoneItemId: z.string().optional(),
        description: z.string().min(1),
        qty: z.number().nonnegative(),
        unitPrice: z.number().nonnegative(),
        discount: z.number().nonnegative().optional()
      })
    )
    .optional()
});

function requiresBranch(items) {
  return items.some((item) => Boolean(item.productId));
}

async function resolveBranch(companyId, branchId) {
  if (!branchId) return null;
  ensureObjectId(branchId, "branch id");
  const branch = await Branch.findOne({ _id: branchId, companyId, isActive: true }).lean();
  if (!branch) {
    const err = new Error("Branch not found");
    err.status = 400;
    throw err;
  }
  return branch;
}

async function hydrateProductFields(companyId, items) {
  const productIds = items
    .map((item) => item.productId)
    .filter(Boolean)
    .map((id) => {
      ensureObjectId(id, "product id");
      return id;
    });
  if (productIds.length === 0) return items;

  const products = await Product.find({ _id: { $in: productIds }, companyId }).lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return items.map((item) => {
    if (!item.productId) return item;
    const product = productMap.get(String(item.productId));
    if (!product) {
      const err = new Error("Product not found");
      err.status = 400;
      throw err;
    }
    return {
      ...item,
      productSku: product.sku || item.productSku,
      productName: product.name || item.productName
    };
  });
}

async function logSaleChange({ sale, operation, req }) {
  if (!sale) return;
  const payload = sale.toObject ? sale.toObject() : sale;
  await ChangeLog.create({
    companyId: sale.companyId,
    workspaceId: sale.workspaceId || String(req.user.companyId),
    userId: req.user._id,
    deviceId: sale.deviceId || req.headers["x-device-id"] || "server",
    entityType: "sale",
    recordId: sale._id.toString(),
    operation,
    version: sale.version || 1,
    payload,
    changedAt: new Date()
  });
}

function buildSaleFilter(query) {
  const { status, from, to, q } = query;
  const filter = { deletedAt: null };
  if (status) filter.status = status;
  if (q) {
    const term = String(q).trim();
    filter.$or = [
      { customerName: { $regex: term, $options: "i" } },
      { customerPhone: { $regex: term, $options: "i" } },
      { saleNo: { $regex: term, $options: "i" } }
    ];
  }
  if (from || to) {
    filter.issueDate = {};
    const fromDate = parseOptionalDate(from, "from");
    const toDate = parseOptionalDate(to, "to");
    if (fromDate) filter.issueDate.$gte = fromDate;
    if (toDate) filter.issueDate.$lte = toDate;
  }
  return filter;
}

async function resolveCustomer(companyId, workspaceId, customerId) {
  if (!customerId) return null;
  ensureObjectId(customerId, "customer id");
  return Customer.findOne(withWorkspaceScope({ _id: customerId, companyId, deletedAt: null }, workspaceId)).lean();
}

async function resolveTradeIn(companyId, workspaceId, tradeInId) {
  if (!tradeInId) return null;
  ensureObjectId(tradeInId, "trade-in id");
  const tradeIn = await TradeIn.findOne(withWorkspaceScope({ _id: tradeInId, companyId, deletedAt: null }, workspaceId));
  if (!tradeIn) {
    const err = new Error("Trade-in not found");
    err.status = 400;
    throw err;
  }
  if (tradeIn.status !== "accepted") {
    const err = new Error("Trade-in must be accepted before applying");
    err.status = 400;
    throw err;
  }
  if (tradeIn.appliedSaleId || tradeIn.appliedInvoiceId || tradeIn.status === "applied") {
    const err = new Error("Trade-in is already applied");
    err.status = 409;
    throw err;
  }
  return tradeIn;
}

function tradeInCreditAmount(tradeIn) {
  if (!tradeIn) return 0;
  const credit = tradeIn.creditAmount ?? tradeIn.agreedAmount ?? 0;
  return Math.max(0, Number(credit || 0));
}

async function hydratePhoneFields(companyId, workspaceId, items) {
  const phoneItemIds = items
    .map((item) => item.phoneItemId)
    .filter(Boolean)
    .map((id) => {
      ensureObjectId(id, "phone inventory id");
      return id;
    });
  if (phoneItemIds.length === 0) return items;
  const phones = await PhoneInventoryItem.find(
    withWorkspaceScope({ _id: { $in: phoneItemIds }, companyId, deletedAt: null }, workspaceId)
  ).lean();
  const map = new Map(phones.map((p) => [String(p._id), p]));
  return items.map((item) => {
    if (!item.phoneItemId) return item;
    const phone = map.get(String(item.phoneItemId));
    if (!phone) {
      const err = new Error("Phone inventory item not found");
      err.status = 400;
      throw err;
    }
    if (item.productId) {
      const err = new Error("Sale item cannot include both productId and phoneItemId");
      err.status = 400;
      throw err;
    }
    if (Number(item.qty) !== 1) {
      const err = new Error("Phone inventory sale items must have qty = 1");
      err.status = 400;
      throw err;
    }
    return {
      ...item,
      phoneImei: phone.imei || undefined,
      phoneSerial: phone.serial || undefined
    };
  });
}

router.get("/", async (req, res) => {
  try {
    const { limit, page } = req.query;
    const workspaceId = resolveWorkspaceId(req);
    const filter = withWorkspaceScope({ ...buildSaleFilter(req.query), companyId: req.user.companyId }, workspaceId);
    const safeLimit = parseLimit(limit, { defaultLimit: 200, maxLimit: 500 });
    const pageNum = parsePage(page);
    const total = await Sale.countDocuments(filter);
    const skip = (pageNum - 1) * safeLimit;
    const sales = await Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: sales.length, sales });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list sales");
  }
});

// Export sales to Excel
router.get("/export.xlsx", async (req, res) => {
  try {
    const { limit } = req.query;
    const workspaceId = resolveWorkspaceId(req);
    const filter = withWorkspaceScope({ ...buildSaleFilter(req.query), companyId: req.user.companyId }, workspaceId);
    const safeLimit = parseLimit(limit, { defaultLimit: 2000, maxLimit: 5000 });
    const sales = await Sale.find(filter).sort({ createdAt: -1 }).limit(safeLimit).lean();
    const workbook = buildSalesWorkbook(sales);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="sales.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export sales");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "sale id");
    const workspaceId = resolveWorkspaceId(req);
    const sale = await Sale.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    ).lean();
    if (!sale) return res.status(404).json({ error: "Sale not found" });
    res.json({ sale });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get sale");
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = SaleCreateSchema.parse(req.body);
    const workspaceId = resolveWorkspaceId(req);
    let saleNo = parsed.saleNo ? parsed.saleNo.trim() : "";
    if (saleNo) {
      const existing = await Sale.findOne({ companyId: req.user.companyId, saleNo }).lean();
      if (existing) return res.status(400).json({ error: "Sale number already exists" });
    } else {
      saleNo = await nextNumber("SAL", Sale, "saleNo", "^SAL-");
    }

    const hydratedProducts = await hydrateProductFields(req.user.companyId, parsed.items);
    const hydratedItems = await hydratePhoneFields(req.user.companyId, workspaceId, hydratedProducts);
    const items = buildItems(hydratedItems);
    const vatRate = parsed.vatRate ?? 0;
    const { subtotal, vatAmount, total } = calcTotals(items, vatRate, 0, 0);
    const issueDate = parseOptionalDate(parsed.issueDate, "issueDate") || new Date();
    const requestedStatus = parsed.status || "paid";
    if (requestedStatus === "cancelled" && parsed.tradeInId) {
      return res.status(400).json({ error: "Cannot apply trade-in to a cancelled sale" });
    }
    const tradeIn = await resolveTradeIn(req.user.companyId, workspaceId, parsed.tradeInId).catch((err) => {
      if (parsed.tradeInId) throw err;
      return null;
    });
    const tradeInCredit = requestedStatus === "cancelled" ? 0 : tradeInCreditAmount(tradeIn);
    const cashPaidRaw =
      requestedStatus === "cancelled"
        ? 0
        : parsed.amountPaid !== undefined
        ? parsed.amountPaid
        : requestedStatus === "paid"
        ? total
        : 0;
    const amountPaid =
      requestedStatus === "cancelled" ? 0 : Math.min(total, Math.max(0, Number(cashPaidRaw || 0) + tradeInCredit));
    const balance = Math.max(0, total - amountPaid);
    const status = requestedStatus === "cancelled" ? "cancelled" : balance === 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid";

    const branch = await resolveBranch(req.user.companyId, parsed.branchId);
    if (status !== "cancelled" && !branch && requiresBranch(items)) {
      return res.status(400).json({ error: "Branch is required for inventory items" });
    }

    const customer = await resolveCustomer(req.user.companyId, workspaceId, parsed.customerId);
    const salespersonId = parsed.salespersonId ? String(parsed.salespersonId).trim() : "";
    if (salespersonId) ensureObjectId(salespersonId, "salesperson id");

    const session = await Sale.startSession();
    session.startTransaction();
    let sale;
    try {
      sale = new Sale({
        saleNo,
        companyId: req.user.companyId,
        workspaceId,
        userId: req.user._id,
        deviceId: String(req.headers["x-device-id"] || "server"),
        customerId: customer ? customer._id : parsed.customerId ? parsed.customerId : null,
        customerName: parsed.customerName || customer?.name || "Walk-in",
        customerPhone: parsed.customerPhone || customer?.phone,
        customerTpin: parsed.customerTpin,
        salespersonId: salespersonId || req.user._id,
        tradeInId: tradeIn ? tradeIn._id : null,
        tradeInCredit,
        branchId: branch ? branch._id : null,
        branchName: branch ? branch.name : undefined,
        issueDate,
        status,
        vatRate,
        items,
        subtotal,
        vatAmount,
        total,
        amountPaid,
        balance
      });

      const inventoryResult = await applyInvoiceInventory({
        companyId: req.user.companyId,
        invoice: { ...sale.toObject(), items: status === "cancelled" ? [] : sale.items, invoiceType: "sale" },
        previousInvoice: null,
        session
      });
      if (inventoryResult.shortages.length > 0) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Insufficient stock for this sale",
          shortages: inventoryResult.shortages
        });
      }

      await sale.save({ session });
      await replaceInvoiceMovements({
        companyId: req.user.companyId,
        invoice: { ...sale.toObject(), items: status === "cancelled" ? [] : sale.items, invoiceType: "sale" },
        session,
        sourceType: "sale",
        note: sale.saleNo
      });

      if (tradeIn) {
        tradeIn.status = "applied";
        tradeIn.appliedSaleId = sale._id;
        tradeIn.appliedAt = new Date();
        await tradeIn.save({ session });
      }

      await syncPhoneInventoryForSale({
        companyId: req.user.companyId,
        sale: sale.toObject(),
        previousSale: null,
        session
      });

      await upsertReceiptInvoiceForSale({ req, sale, session });
      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      session.endSession();
    }
    if (sale) {
      try {
        await logSaleChange({ sale, operation: "create", req });
      } catch (err) {
        // ignore log failures
      }
    }
    return res.status(201).json({ sale });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create sale");
  }
});

router.put("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "sale id");
    const parsed = SaleUpdateSchema.parse(req.body);
    const workspaceId = resolveWorkspaceId(req);
    const session = await Sale.startSession();
    session.startTransaction();
    let sale;
    try {
      sale = await Sale.findOne({ _id: req.params.id, companyId: req.user.companyId }).session(session);
      if (!sale) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.status(404).json({ error: "Sale not found" });
      }

      const previous = sale.toObject();
      const nextItemsProducts = parsed.items ? await hydrateProductFields(req.user.companyId, parsed.items) : sale.items;
      const nextItemsRaw = parsed.items
        ? await hydratePhoneFields(req.user.companyId, workspaceId, nextItemsProducts)
        : sale.items;
      const items = buildItems(nextItemsRaw);
      const vatRate = parsed.vatRate ?? sale.vatRate ?? 0;
      const { subtotal, vatAmount, total } = calcTotals(items, vatRate, 0, 0);
      let status = parsed.status || sale.status;

      if (status === "cancelled" && parsed.tradeInId) {
        await session.abortTransaction();
        return res.status(400).json({ error: "Cannot apply trade-in to a cancelled sale" });
      }

      if (parsed.tradeInId !== undefined && parsed.tradeInId) {
        if (sale.tradeInId && String(sale.tradeInId) !== String(parsed.tradeInId)) {
          await session.abortTransaction();
          return res.status(400).json({ error: "Trade-in cannot be changed once applied" });
        }
        if (!sale.tradeInId) {
          const tradeIn = await resolveTradeIn(req.user.companyId, workspaceId, parsed.tradeInId);
          sale.tradeInId = tradeIn._id;
          sale.tradeInCredit = tradeInCreditAmount(tradeIn);
          tradeIn.status = "applied";
          tradeIn.appliedSaleId = sale._id;
          tradeIn.appliedAt = new Date();
          await tradeIn.save({ session });
        }
      }

      // If sale is cancelled, free up any applied trade-in.
      if (status === "cancelled" && sale.tradeInId) {
        const tradeIn = await TradeIn.findOne(
          withWorkspaceScope({ _id: sale.tradeInId, companyId: req.user.companyId, deletedAt: null }, workspaceId)
        ).session(session);
        if (tradeIn && String(tradeIn.appliedSaleId || "") === String(sale._id)) {
          tradeIn.status = "accepted";
          tradeIn.appliedSaleId = null;
          tradeIn.appliedAt = undefined;
          await tradeIn.save({ session });
        }
        sale.tradeInId = null;
        sale.tradeInCredit = 0;
      }

      const tradeInCredit = Number(sale.tradeInCredit || 0);
      const cashPaidRaw =
        parsed.amountPaid !== undefined
          ? parsed.amountPaid
          : status === "paid"
          ? Math.max(0, total - tradeInCredit)
          : Math.max(0, Number(sale.amountPaid || 0) - tradeInCredit);
      const amountPaid = Math.min(total, Math.max(0, Number(cashPaidRaw || 0) + tradeInCredit));
      const balance = Math.max(0, total - amountPaid);
      if (status !== "cancelled") {
        status = balance === 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid";
      }

      if (parsed.branchId !== undefined && parsed.branchId) {
        ensureObjectId(parsed.branchId, "branch id");
      }
      const branch = await resolveBranch(req.user.companyId, parsed.branchId || sale.branchId);
      if (status !== "cancelled" && !branch && requiresBranch(items)) {
        await session.abortTransaction();
        return res.status(400).json({ error: "Branch is required for inventory items" });
      }

      if (parsed.customerName !== undefined) sale.customerName = parsed.customerName || "Walk-in";
      if (parsed.customerPhone !== undefined) sale.customerPhone = parsed.customerPhone;
      if (parsed.customerTpin !== undefined) sale.customerTpin = parsed.customerTpin;
      if (parsed.customerId !== undefined) {
        const customer = await resolveCustomer(req.user.companyId, workspaceId, parsed.customerId);
        sale.customerId = customer ? customer._id : parsed.customerId ? parsed.customerId : null;
        if (customer && parsed.customerName === undefined) sale.customerName = customer.name;
        if (customer && parsed.customerPhone === undefined) sale.customerPhone = customer.phone;
      }
      if (parsed.salespersonId !== undefined) {
        const sp = parsed.salespersonId ? String(parsed.salespersonId).trim() : "";
        if (sp) ensureObjectId(sp, "salesperson id");
        sale.salespersonId = sp || null;
      }
      if (parsed.issueDate !== undefined) sale.issueDate = parseDateOrThrow(parsed.issueDate, "issueDate");
      sale.status = status;
      if (parsed.vatRate !== undefined) sale.vatRate = parsed.vatRate;
      if (parsed.items !== undefined) sale.items = items;
      sale.branchId = branch ? branch._id : null;
      sale.branchName = branch ? branch.name : undefined;
      sale.subtotal = subtotal;
      sale.vatAmount = vatAmount;
      sale.total = total;
      sale.amountPaid = amountPaid;
      sale.balance = balance;
      sale.workspaceId = sale.workspaceId || workspaceId;
      sale.userId = req.user._id;
      sale.deviceId = String(req.headers["x-device-id"] || "server");
      sale.version = (sale.version || 1) + 1;

      const inventoryInvoice = { ...sale.toObject(), items: status === "cancelled" ? [] : sale.items, invoiceType: "sale" };
      const previousInvoiceForInventory = {
        ...previous,
        items: String(previous.status) === "cancelled" || previous.deletedAt ? [] : previous.items,
        invoiceType: "sale"
      };

      const inventoryResult = await applyInvoiceInventory({
        companyId: req.user.companyId,
        invoice: inventoryInvoice,
        previousInvoice: previousInvoiceForInventory,
        session
      });
      if (inventoryResult.shortages.length > 0) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Insufficient stock for this sale update",
          shortages: inventoryResult.shortages
        });
      }

      await sale.save({ session });
      await replaceInvoiceMovements({
        companyId: req.user.companyId,
        invoice: inventoryInvoice,
        session,
        sourceType: "sale",
        note: sale.saleNo
      });

      await syncPhoneInventoryForSale({
        companyId: req.user.companyId,
        sale: sale.toObject(),
        previousSale: previous,
        session
      });

      await upsertReceiptInvoiceForSale({ req, sale, session });
      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      session.endSession();
    }
    if (sale) {
      try {
        await logSaleChange({ sale, operation: "update", req });
      } catch (err) {
        // ignore log failures
      }
    }
    res.json({ sale });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update sale");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "sale id");
    const workspaceId = resolveWorkspaceId(req);
    const session = await Sale.startSession();
    session.startTransaction();
    let sale;
    try {
      sale = await Sale.findOne({ _id: req.params.id, companyId: req.user.companyId }).session(session);
      if (!sale) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.status(404).json({ error: "Sale not found" });
      }

      const previous = sale.toObject();
      const clearedSale = { ...sale.toObject(), items: [], invoiceType: "sale" };
      const inventoryResult = await applyInvoiceInventory({
        companyId: req.user.companyId,
        invoice: clearedSale,
        previousInvoice: { ...sale.toObject(), invoiceType: "sale" },
        session
      });
      if (inventoryResult.shortages.length > 0) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Insufficient stock to delete this sale",
          shortages: inventoryResult.shortages
        });
      }

      await replaceInvoiceMovements({
        companyId: req.user.companyId,
        invoice: clearedSale,
        session,
        sourceType: "sale",
        note: sale.saleNo
      });
      if (sale.tradeInId) {
        const tradeIn = await TradeIn.findOne(
          withWorkspaceScope({ _id: sale.tradeInId, companyId: req.user.companyId, deletedAt: null }, workspaceId)
        ).session(session);
        if (tradeIn && String(tradeIn.appliedSaleId || "") === String(sale._id)) {
          tradeIn.status = "accepted";
          tradeIn.appliedSaleId = null;
          tradeIn.appliedAt = undefined;
          await tradeIn.save({ session });
        }
        sale.tradeInId = null;
        sale.tradeInCredit = 0;
      }
      sale.deletedAt = new Date();
      sale.status = "cancelled";
      sale.version = (sale.version || 1) + 1;
      sale.workspaceId = sale.workspaceId || workspaceId;
      sale.userId = req.user._id;
      sale.deviceId = String(req.headers["x-device-id"] || "server");
      await sale.save({ session });

      await syncPhoneInventoryForSale({
        companyId: req.user.companyId,
        sale: sale.toObject(),
        previousSale: previous,
        session
      });

      // Ensure any linked receipt is hidden once the sale is deleted.
      if (sale.receiptInvoiceId) {
        const receipt = await Invoice.findOne({ _id: sale.receiptInvoiceId, companyId: req.user.companyId }).session(
          session
        );
        if (receipt) {
          receipt.status = "cancelled";
          receipt.deletedAt = receipt.deletedAt || new Date();
          receipt.version = (receipt.version || 1) + 1;
          await receipt.save({ session });
        }
      }
      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      session.endSession();
    }
    if (sale) {
      try {
        await logSaleChange({ sale, operation: "delete", req });
      } catch (err) {
        // ignore log failures
      }
    }
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete sale");
  }
});

module.exports = router;
