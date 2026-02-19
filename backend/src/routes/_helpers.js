async function nextNumber(prefix, Model, field, regexPrefix = null) {
  const rx = regexPrefix || `^${prefix}-`;
  const latest = await Model.findOne({ [field]: new RegExp(rx) }).sort({ createdAt: -1 }).lean();
  if (!latest) return `${prefix}-0001`;

  const last = String(latest[field]);
  const num = parseInt(last.split("-").pop(), 10);
  const next = String(num + 1).padStart(4, "0");
  return `${prefix}-${next}`;
}

function parseDateOrThrow(value, label = "date") {
  const date = new Date(String(value));
  if (!value || Number.isNaN(date.getTime())) {
    const err = new Error(`Invalid ${label}`);
    err.status = 400;
    throw err;
  }
  return date;
}

function parseOptionalDate(value, label) {
  if (value === undefined || value === null || value === "") return null;
  return parseDateOrThrow(value, label);
}

function ensureObjectId(value, label = "id") {
  const mongoose = require("mongoose");
  if (!mongoose.isValidObjectId(String(value))) {
    const err = new Error(`Invalid ${label}`);
    err.status = 400;
    throw err;
  }
  return value;
}

function parseLimit(value, { defaultLimit = 200, maxLimit = 500 } = {}) {
  if (value === undefined || value === null || value === "") return defaultLimit;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    const err = new Error("Invalid limit");
    err.status = 400;
    throw err;
  }
  return Math.min(Math.floor(num), maxLimit);
}

function parsePage(value) {
  if (value === undefined || value === null || value === "") return 1;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    const err = new Error("Invalid page");
    err.status = 400;
    throw err;
  }
  return Math.floor(num);
}

function handleRouteError(res, err, fallbackMessage) {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  if (err?.name === "ZodError") return res.status(400).json({ error: err.issues });
  return res.status(500).json({ error: fallbackMessage, details: String(err) });
}

function buildItems(rawItems) {
  return rawItems.map((it) => {
    const qty = Number(it.qty);
    const unitPrice = Number(it.unitPrice);
    const discount = Number(it.discount || 0);
    const lineTotal = Math.max(0, qty * unitPrice - discount);
    return {
      description: String(it.description),
      qty,
      unitPrice,
      discount,
      lineTotal,
      productId: it.productId || undefined,
      productSku: it.productSku || undefined,
      productName: it.productName || undefined
    };
  });
}

function calcTotals(items, vatRate, shippingCost = 0, shippingTaxRate = 0) {
  const itemsSubtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const shippingValue = Number(shippingCost || 0);
  const shippingVat = (shippingValue * (shippingTaxRate || 0)) / 100;
  const vatAmount = (itemsSubtotal * (vatRate || 0)) / 100 + shippingVat;
  const subtotal = itemsSubtotal + shippingValue;
  const total = subtotal + vatAmount;
  return { subtotal, vatAmount, total };
}

module.exports = {
  nextNumber,
  buildItems,
  calcTotals,
  parseDateOrThrow,
  parseOptionalDate,
  ensureObjectId,
  parseLimit,
  parsePage,
  handleRouteError
};
