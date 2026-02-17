const { buildItems } = require("../../routes/_helpers");

function mapZraStatus(status) {
  const normalized = String(status || "").toUpperCase();
  switch (normalized) {
    case "ZRA_PENDING":
      return "imported_pending";
    case "ZRA_APPROVED":
      return "imported_approved";
    case "ZRA_REJECTED":
      return "imported_rejected";
    case "ZRA_CANCELLED":
      return "cancelled";
    case "ZRA_CREDIT_NOTE":
      return "credited";
    default:
      return "imported_pending";
  }
}

function extractItems(payload) {
  const rawItems = payload.items || payload.lines || payload.details || [];
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];
  return rawItems.map((item) => ({
    description: item.description || item.name || item.serviceName || "Item",
    qty: Number(item.qty ?? item.quantity ?? 1),
    unitPrice: Number(item.unitPrice ?? item.price ?? item.unitSupplyPrice ?? 0),
    discount: Number(item.discount ?? item.discountAmount ?? 0)
  }));
}

function mapZraDocumentToInvoice(payload) {
  const customerName =
    payload.customerName || payload.buyerName || payload.buyer?.name || payload.customer?.name || "Unknown";
  const customerTpin =
    payload.customerTpin || payload.buyerTpin || payload.buyer?.tpin || payload.customer?.tpin || "";
  const dueDate = payload.dueDate || payload.date || payload.issueDate;
  const vatRate = Number(payload.vatRate ?? payload.taxRate ?? 0);
  const items = extractItems(payload);

  if (!dueDate || items.length === 0) {
    return null;
  }

  return {
    customerName,
    customerTpin,
    dueDate,
    vatRate,
    items: buildItems(items)
  };
}

module.exports = { mapZraStatus, mapZraDocumentToInvoice };
