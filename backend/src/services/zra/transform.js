function buildZraInvoicePayload(invoice, connection) {
  return {
    tpin: connection.tpin,
    branchId: connection.branchId,
    invoiceNo: invoice.invoiceNo,
    customerName: invoice.customerName,
    customerTpin: invoice.customerTpin,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    vatRate: invoice.vatRate,
    items: invoice.items.map((item) => ({
      description: item.description,
      qty: item.qty,
      unitPrice: item.unitPrice,
      discount: item.discount || 0
    })),
    totals: {
      subtotal: invoice.subtotal,
      vatAmount: invoice.vatAmount,
      total: invoice.total
    }
  };
}

function buildZraCancelPayload(invoice, connection, reason) {
  return {
    tpin: connection.tpin,
    branchId: connection.branchId,
    receiptNo: invoice.zraReceiptNo || invoice.invoiceNo,
    reason: reason || "User requested cancellation"
  };
}

function buildZraCreditPayload(invoice, connection, creditNote) {
  return {
    tpin: connection.tpin,
    branchId: connection.branchId,
    receiptNo: invoice.zraReceiptNo || invoice.invoiceNo,
    creditNote
  };
}

module.exports = { buildZraInvoicePayload, buildZraCancelPayload, buildZraCreditPayload };
