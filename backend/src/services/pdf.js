const PDFDocument = require("pdfkit");

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function renderTableHeader(doc, y) {
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text("Description", 50, y);
  doc.text("Qty", 300, y, { width: 40, align: "right" });
  doc.text("Unit", 350, y, { width: 70, align: "right" });
  doc.text("Discount", 430, y, { width: 70, align: "right" });
  doc.text("Line Total", 510, y, { width: 80, align: "right" });
  doc.moveTo(50, y + 16).lineTo(570, y + 16).strokeColor("#aaaaaa").stroke();
  doc.font("Helvetica");
}

function renderItemsTable(doc, items, startY) {
  let y = startY;
  renderTableHeader(doc, y);
  y += 24;

  items.forEach((item) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
      renderTableHeader(doc, y);
      y += 24;
    }

    const lineTotal = item.lineTotal ?? item.qty * item.unitPrice - (item.discount || 0);
    doc.fontSize(10).text(item.description, 50, y, { width: 240 });
    doc.text(String(item.qty), 300, y, { width: 40, align: "right" });
    doc.text(item.unitPrice.toFixed(2), 350, y, { width: 70, align: "right" });
    doc.text((item.discount || 0).toFixed(2), 430, y, { width: 70, align: "right" });
    doc.text(lineTotal.toFixed(2), 510, y, { width: 80, align: "right" });
    y += 18;
  });

  return y;
}

function renderTotals(doc, y, totals) {
  const startX = 380;
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text("Subtotal", startX, y, { width: 100 });
  doc.text(totals.subtotal.toFixed(2), startX + 110, y, { width: 80, align: "right" });
  y += 16;
  doc.font("Helvetica");
  doc.text(`VAT (${totals.vatRate || 0}%)`, startX, y, { width: 100 });
  doc.text(totals.vatAmount.toFixed(2), startX + 110, y, { width: 80, align: "right" });
  y += 16;
  doc.font("Helvetica-Bold");
  doc.text("Total", startX, y, { width: 100 });
  doc.text(totals.total.toFixed(2), startX + 110, y, { width: 80, align: "right" });
  doc.font("Helvetica");
  return y + 18;
}

function renderNotes(doc, y, label, text) {
  if (!text) return y;
  doc.fontSize(11).font("Helvetica-Bold").text(label, 50, y);
  doc.font("Helvetica").fontSize(10).text(text, 50, y + 16, { width: 520 });
  return y + 46;
}

function buildCompanyLines(company) {
  if (!company) return [];
  const lines = [];
  lines.push(company.legalName || company.name);
  if (company.address?.line1) lines.push(company.address.line1);
  if (company.address?.line2) lines.push(company.address.line2);
  const cityLine = [company.address?.city, company.address?.state, company.address?.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  if (company.address?.country) lines.push(company.address.country);
  if (company.email) lines.push(company.email);
  if (company.phone) lines.push(company.phone);
  if (company.website) lines.push(company.website);
  if (company.taxId) lines.push(`Tax ID: ${company.taxId}`);
  return lines.filter(Boolean);
}

function renderCompanyBlock(doc, company) {
  const lines = buildCompanyLines(company);
  if (lines.length === 0) return;
  doc.fontSize(11).font("Helvetica-Bold").text(lines[0], 360, 50, { align: "right" });
  doc.font("Helvetica").fontSize(10);
  let y = 66;
  for (let i = 1; i < lines.length; i += 1) {
    doc.text(lines[i], 360, y, { align: "right" });
    y += 14;
  }
}

function renderPaymentBlock(doc, company, y) {
  if (!company?.payment) return y;
  const payment = company.payment;
  const lines = [];
  if (payment.bankName) lines.push(`Bank: ${payment.bankName}`);
  if (payment.accountName) lines.push(`Account Name: ${payment.accountName}`);
  if (payment.accountNumber) lines.push(`Account No: ${payment.accountNumber}`);
  if (payment.routingNumber) lines.push(`Routing: ${payment.routingNumber}`);
  if (payment.swift) lines.push(`SWIFT: ${payment.swift}`);
  if (payment.mobileMoney) lines.push(`Mobile Money: ${payment.mobileMoney}`);
  if (payment.paymentInstructions) lines.push(payment.paymentInstructions);
  if (lines.length === 0) return y;

  doc.fontSize(11).font("Helvetica-Bold").text("Payment Details", 50, y);
  doc.font("Helvetica").fontSize(10);
  let current = y + 16;
  lines.forEach((line) => {
    doc.text(line, 50, current, { width: 520 });
    current += 14;
  });
  return current + 6;
}

function generateQuotePdf(res, quote, company) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="quote-${quote.quoteNo}.pdf"`);
  doc.pipe(res);

  doc.fontSize(24).font("Helvetica-Bold").text("Quote", 50, 50);
  renderCompanyBlock(doc, company);
  doc.fontSize(12).font("Helvetica").text(`Quote No: ${quote.quoteNo}`, 50, 86);
  doc.text(`Customer: ${quote.customerName}`, 50, 104);
  doc.text(`Issue Date: ${formatDate(quote.issueDate)}`, 50, 122);
  doc.text(`Valid Until: ${formatDate(quote.validUntil)}`, 50, 140);
  doc.text(`Status: ${quote.status}`, 50, 158);

  let y = 190;
  y = renderItemsTable(doc, quote.items || [], y);
  y += 10;
  y = renderTotals(doc, y, {
    subtotal: quote.subtotal,
    vatRate: quote.vatRate,
    vatAmount: quote.vatAmount,
    total: quote.total
  });

  y = renderNotes(doc, y + 12, "Notes", quote.notes);
  y = renderNotes(doc, y + 6, "Terms", quote.terms);
  renderPaymentBlock(doc, company, y + 6);

  doc.end();
}

function generateInvoicePdf(res, invoice, company) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`);
  doc.pipe(res);

  doc.fontSize(24).font("Helvetica-Bold").text("Invoice", 50, 50);
  renderCompanyBlock(doc, company);
  doc.fontSize(12).font("Helvetica").text(`Invoice No: ${invoice.invoiceNo}`, 50, 86);
  doc.text(`Customer: ${invoice.customerName}`, 50, 104);
  if (invoice.customerTpin) {
    doc.text(`Customer TPIN: ${invoice.customerTpin}`, 50, 122);
  }
  const infoOffset = invoice.customerTpin ? 18 : 0;
  doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, 50, 122 + infoOffset);
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 50, 140 + infoOffset);
  doc.text(`Status: ${invoice.status}`, 50, 158 + infoOffset);

  let y = 190 + infoOffset;
  y = renderItemsTable(doc, invoice.items || [], y);
  y += 10;
  y = renderTotals(doc, y, {
    subtotal: invoice.subtotal,
    vatRate: invoice.vatRate,
    vatAmount: invoice.vatAmount,
    total: invoice.total
  });

  doc.fontSize(11).font("Helvetica-Bold").text("Payments", 50, y + 12);
  doc.font("Helvetica").fontSize(10).text(`Amount paid: ${invoice.amountPaid.toFixed(2)}`, 50, y + 28);
  doc.text(`Balance: ${invoice.balance.toFixed(2)}`, 50, y + 44);
  renderPaymentBlock(doc, company, y + 70);

  doc.end();
}

module.exports = { generateQuotePdf, generateInvoicePdf };
