const PDFDocument = require("pdfkit");

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

function generateReportsPdf(res, { summary, series, range }) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="reports.pdf"');
  doc.pipe(res);

  doc.fontSize(24).font("Helvetica-Bold").text("Reports Summary", 50, 50);
  doc.fontSize(11).font("Helvetica");
  if (range?.from || range?.to) {
    doc.text(
      `Range: ${range.from ? new Date(range.from).toLocaleDateString() : "Any"} - ${
        range.to ? new Date(range.to).toLocaleDateString() : "Any"
      }`,
      50,
      84
    );
  }

  let y = 120;
  doc.fontSize(12).font("Helvetica-Bold").text("Summary", 50, y);
  y += 18;
  doc.fontSize(10).font("Helvetica");

  const entries = Object.entries(summary || {});
  entries.forEach(([key, value]) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    const label = key.replace(/_/g, " ");
    const output = typeof value === "number" ? formatMoney(value) : String(value);
    doc.text(label, 50, y, { width: 260 });
    doc.text(output, 320, y, { width: 200 });
    y += 16;
  });

  y += 10;
  doc.fontSize(12).font("Helvetica-Bold").text("Monthly Trend", 50, y);
  y += 18;
  doc.fontSize(10).font("Helvetica");
  doc.text("Month", 50, y);
  doc.text("Billed", 180, y);
  doc.text("Paid", 300, y);
  doc.text("Expenses", 420, y);
  y += 16;
  doc.moveTo(50, y).lineTo(550, y).strokeColor("#aaaaaa").stroke();
  y += 10;

  (series || []).forEach((row) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    doc.text(row.month, 50, y);
    doc.text(formatMoney(row.billed), 180, y);
    doc.text(formatMoney(row.paid), 300, y);
    doc.text(formatMoney(row.expenses), 420, y);
    y += 16;
  });

  doc.end();
}

module.exports = { generateReportsPdf };
