const ZraConnection = require("../../models/ZraConnection");
const ZraDocument = require("../../models/ZraDocument");
const Invoice = require("../../models/Invoice");
const { fetchNotices, fetchInvoiceDetails } = require("./client");
const { mapZraStatus, mapZraDocumentToInvoice } = require("./mapping");
const { calcTotals } = require("../../routes/_helpers");

function computeBackoffMinutes(failureCount) {
  const base = 1;
  const max = 60;
  const next = Math.min(max, base * Math.pow(2, Math.max(0, failureCount - 1)));
  return next;
}

async function upsertZraDocument(connection, payload, notice = {}) {
  const receiptNo = payload.receiptNo || payload.invoiceNo || notice.receiptNo || notice.id;
  if (!receiptNo) return null;
  const docType = payload.docType || payload.type || notice.docType || "INVOICE";
  const update = {
    companyId: connection.companyId,
    branchId: connection.branchId,
    tpin: connection.tpin,
    docType,
    receiptNo: String(receiptNo),
    markId: payload.markId || payload.markID || payload.mark_id || notice.markId,
    signature: payload.signature || payload.sign || payload.sig,
    qrData: payload.qrData || payload.qr || payload.qrCode,
    zraStatus: payload.status || notice.status,
    issueDate: payload.issueDate || payload.date,
    dueDate: payload.dueDate,
    currency: payload.currency,
    total: payload.total || payload.totalAmount,
    rawPayload: payload,
    lastSyncedAt: new Date()
  };

  const doc = await ZraDocument.findOneAndUpdate(
    {
      companyId: connection.companyId,
      branchId: connection.branchId,
      receiptNo: String(receiptNo),
      docType
    },
    { $set: update },
    { upsert: true, new: true }
  );

  return doc;
}

async function ensureInvoiceFromZra(connection, doc, payload) {
  if (!doc) return null;
  if (doc.invoiceId) return null;

  const existing = await Invoice.findOne({
    companyId: connection.companyId,
    zraReceiptNo: doc.receiptNo
  });
  if (existing) {
    doc.invoiceId = existing._id;
    await doc.save();
    return existing;
  }

  const mapped = mapZraDocumentToInvoice(payload);
  if (!mapped) return null;

  const status = mapZraStatus(doc.zraStatus);
  const { subtotal, vatAmount, total } = calcTotals(mapped.items, mapped.vatRate || 0, 0, 0);
  const amountPaid = status === "paid" ? total : 0;
  const balance = Math.max(0, total - amountPaid);

  const dueDate = new Date(mapped.dueDate);
  const safeDueDate = Number.isNaN(dueDate.getTime()) ? new Date() : dueDate;
  const invoice = await Invoice.create({
    invoiceNo: String(doc.receiptNo),
    companyId: connection.companyId,
    customerName: mapped.customerName,
    customerTpin: mapped.customerTpin || undefined,
    dueDate: safeDueDate,
    status,
    vatRate: mapped.vatRate || 0,
    items: mapped.items,
    subtotal,
    vatAmount,
    total,
    amountPaid,
    balance,
    source: "ZRA",
    zraReceiptNo: doc.receiptNo,
    zraMarkId: doc.markId,
    zraSignature: doc.signature,
    zraQrData: doc.qrData,
    zraStatus: doc.zraStatus,
    lockedAt: new Date(),
    lockedReason: "ZRA_IMPORTED"
  });

  doc.invoiceId = invoice._id;
  await doc.save();
  return invoice;
}

async function syncConnection(connection) {
  if (!connection.enabled || !connection.syncEnabled) return { skipped: true };
  if (connection.backoffUntil && connection.backoffUntil > new Date()) {
    return { skipped: true, reason: "backoff" };
  }
  if (connection.lastSyncAt && connection.syncIntervalMinutes) {
    const nextAt = new Date(connection.lastSyncAt.getTime() + connection.syncIntervalMinutes * 60 * 1000);
    if (nextAt > new Date()) {
      return { skipped: true, reason: "interval" };
    }
  }

  const notices = await fetchNotices(connection, connection.lastSyncAt);
  const items = Array.isArray(notices?.items) ? notices.items : Array.isArray(notices) ? notices : [];

  for (const notice of items) {
    const receiptNo = notice.receiptNo || notice.id;
    if (!receiptNo) continue;
    const payload = await fetchInvoiceDetails(connection, receiptNo);
    const doc = await upsertZraDocument(connection, payload, notice);
    await ensureInvoiceFromZra(connection, doc, payload);
  }

  return { imported: items.length };
}

async function runZraSync() {
  const connections = await ZraConnection.find({ enabled: true, syncEnabled: true });
  for (const connection of connections) {
    try {
      await syncConnection(connection);
      connection.lastSyncAt = new Date();
      connection.lastSyncStatus = "ok";
      connection.lastSyncError = "";
      connection.failureCount = 0;
      connection.backoffUntil = null;
      await connection.save();
    } catch (err) {
      const failureCount = (connection.failureCount || 0) + 1;
      connection.failureCount = failureCount;
      connection.lastSyncStatus = "error";
      connection.lastSyncError = err?.message ? String(err.message) : "Sync failed";
      const minutes = computeBackoffMinutes(failureCount);
      connection.backoffUntil = new Date(Date.now() + minutes * 60 * 1000);
      await connection.save();
    }
  }
}

module.exports = { runZraSync, syncConnection };
