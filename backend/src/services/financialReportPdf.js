const PDFDocument = require("pdfkit");

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

function drawKeyValue(doc, label, value, xLabel, xValue, y) {
  doc.font("Helvetica").fontSize(10).text(label, xLabel, y, { width: xValue - xLabel - 10 });
  doc.font("Helvetica").fontSize(10).text(String(value), xValue, y, { width: 160, align: "right" });
}

function initDoc(res, filename) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

function generateIncomeStatementPdf(res, data) {
  const doc = initDoc(res, "income_statement.pdf");
  doc.fontSize(22).font("Helvetica-Bold").text("Income Statement (Profit & Loss)", 50, 50);
  doc.fontSize(10).font("Helvetica").text(`From: ${data.range.from || "Any"}  To: ${data.range.to || "Any"}`, 50, 82);

  let y = 120;
  doc.fontSize(12).font("Helvetica-Bold").text("Totals", 50, y);
  y += 18;
  drawKeyValue(doc, "Total Revenue", formatMoney(data.totals.totalRevenue), 50, 380, y);
  y += 14;
  drawKeyValue(doc, "Total Expenses", formatMoney(data.totals.totalExpenses), 50, 380, y);
  y += 14;
  doc.moveTo(50, y + 10).lineTo(540, y + 10).strokeColor("#cccccc").stroke();
  y += 18;
  drawKeyValue(doc, "Net Profit", formatMoney(data.totals.netProfit), 50, 380, y);
  y += 28;

  if (data.comparison) {
    doc.fontSize(12).font("Helvetica-Bold").text("Comparison (Previous Period)", 50, y);
    y += 18;
    drawKeyValue(doc, "Previous Revenue", formatMoney(data.comparison.previousTotals.totalRevenue), 50, 380, y);
    y += 14;
    drawKeyValue(doc, "Previous Expenses", formatMoney(data.comparison.previousTotals.totalExpenses), 50, 380, y);
    y += 14;
    drawKeyValue(doc, "Previous Net Profit", formatMoney(data.comparison.previousTotals.netProfit), 50, 380, y);
    y += 24;
  }

  doc.fontSize(12).font("Helvetica-Bold").text("Expenses by Category", 50, y);
  y += 18;
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Category", 50, y, { width: 320 });
  doc.text("Total", 380, y, { width: 160, align: "right" });
  y += 14;
  doc.moveTo(50, y).lineTo(540, y).strokeColor("#cccccc").stroke();
  y += 8;

  const categories = data.breakdown?.expensesByCategory || [];
  doc.fontSize(10).font("Helvetica");
  categories.slice(0, 30).forEach((row) => {
    if (y > 730) {
      doc.addPage();
      y = 50;
    }
    doc.text(String(row.category || "Uncategorized"), 50, y, { width: 320 });
    doc.text(formatMoney(row.total || 0), 380, y, { width: 160, align: "right" });
    y += 14;
  });

  doc.end();
}

function generateBalanceSheetPdf(res, data) {
  const doc = initDoc(res, "balance_sheet.pdf");
  doc.fontSize(22).font("Helvetica-Bold").text("Balance Sheet", 50, 50);
  doc.fontSize(10).font("Helvetica").text(`As at: ${data.asAt}`, 50, 82);

  let y = 120;
  const section = (title) => {
    doc.fontSize(12).font("Helvetica-Bold").text(title, 50, y);
    y += 18;
  };

  section("Assets");
  drawKeyValue(doc, "Cash", formatMoney(data.assets.cash), 50, 380, y);
  y += 14;
  drawKeyValue(doc, "Accounts Receivable", formatMoney(data.assets.accountsReceivable), 50, 380, y);
  y += 14;
  doc.moveTo(50, y + 10).lineTo(540, y + 10).strokeColor("#cccccc").stroke();
  y += 18;
  drawKeyValue(doc, "Total Assets", formatMoney(data.assets.total), 50, 380, y);
  y += 28;

  section("Liabilities");
  drawKeyValue(doc, "Obligations", formatMoney(data.liabilities.obligations), 50, 380, y);
  y += 14;
  doc.moveTo(50, y + 10).lineTo(540, y + 10).strokeColor("#cccccc").stroke();
  y += 18;
  drawKeyValue(doc, "Total Liabilities", formatMoney(data.liabilities.total), 50, 380, y);
  y += 28;

  section("Equity");
  drawKeyValue(doc, "Owner Equity (derived)", formatMoney(data.equity.ownerEquity), 50, 380, y);
  y += 14;
  drawKeyValue(doc, "Retained Earnings", formatMoney(data.equity.retainedEarnings), 50, 380, y);
  y += 14;
  doc.moveTo(50, y + 10).lineTo(540, y + 10).strokeColor("#cccccc").stroke();
  y += 18;
  drawKeyValue(doc, "Total Equity", formatMoney(data.equity.total), 50, 380, y);
  y += 24;

  doc.fontSize(10).font("Helvetica").text(`Balanced: ${data.balanced ? "Yes" : "No"}  Diff: ${formatMoney(data.balanceDiff)}`, 50, y);
  doc.end();
}

function generateCashFlowPdf(res, data) {
  const doc = initDoc(res, "cash_flow.pdf");
  doc.fontSize(22).font("Helvetica-Bold").text("Cash Flow Summary (Simplified)", 50, 50);
  doc.fontSize(10).font("Helvetica").text(`From: ${data.range.from || "Any"}  To: ${data.range.to || "Any"}`, 50, 82);

  let y = 120;
  doc.fontSize(12).font("Helvetica-Bold").text("Cash Movement", 50, y);
  y += 18;
  drawKeyValue(doc, "Cash In", formatMoney(data.cashIn), 50, 380, y);
  y += 14;
  drawKeyValue(doc, "Cash Out", formatMoney(data.cashOut), 50, 380, y);
  y += 14;
  doc.moveTo(50, y + 10).lineTo(540, y + 10).strokeColor("#cccccc").stroke();
  y += 18;
  drawKeyValue(doc, "Net Cash Flow", formatMoney(data.netCashFlow), 50, 380, y);
  y += 24;

  doc.fontSize(12).font("Helvetica-Bold").text("Opening / Closing", 50, y);
  y += 18;
  drawKeyValue(doc, "Opening Cash", formatMoney(data.openingCash), 50, 380, y);
  y += 14;
  drawKeyValue(doc, "Closing Cash", formatMoney(data.closingCash), 50, 380, y);
  y += 22;

  doc.fontSize(10).font("Helvetica").text(`Cash source: ${data.cashSource || "payments"}`, 50, y);
  doc.end();
}

module.exports = {
  generateIncomeStatementPdf,
  generateBalanceSheetPdf,
  generateCashFlowPdf
};

