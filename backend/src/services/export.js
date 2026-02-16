const ExcelJS = require("exceljs");

function buildQuotesWorkbook(quotes) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Quotes");

  sheet.columns = [
    { header: "Quote No", key: "quoteNo", width: 14 },
    { header: "Customer", key: "customerName", width: 22 },
    { header: "Status", key: "status", width: 12 },
    { header: "Issue Date", key: "issueDate", width: 14 },
    { header: "Valid Until", key: "validUntil", width: 14 },
    { header: "Subtotal", key: "subtotal", width: 12 },
    { header: "VAT Rate", key: "vatRate", width: 10 },
    { header: "VAT Amount", key: "vatAmount", width: 12 },
    { header: "Total", key: "total", width: 12 }
  ];

  quotes.forEach((quote) => {
    sheet.addRow({
      quoteNo: quote.quoteNo,
      customerName: quote.customerName,
      status: quote.status,
      issueDate: quote.issueDate ? new Date(quote.issueDate).toLocaleDateString() : "",
      validUntil: quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : "",
      subtotal: quote.subtotal,
      vatRate: quote.vatRate,
      vatAmount: quote.vatAmount,
      total: quote.total
    });
  });

  return workbook;
}

function buildInvoicesWorkbook(invoices) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Invoices");

  sheet.columns = [
    { header: "Invoice No", key: "invoiceNo", width: 14 },
    { header: "Customer", key: "customerName", width: 22 },
    { header: "Customer TPIN", key: "customerTpin", width: 18 },
    { header: "Status", key: "status", width: 12 },
    { header: "Issue Date", key: "issueDate", width: 14 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Subtotal", key: "subtotal", width: 12 },
    { header: "VAT Rate", key: "vatRate", width: 10 },
    { header: "VAT Amount", key: "vatAmount", width: 12 },
    { header: "Total", key: "total", width: 12 },
    { header: "Paid", key: "amountPaid", width: 12 },
    { header: "Balance", key: "balance", width: 12 }
  ];

  invoices.forEach((invoice) => {
    sheet.addRow({
      invoiceNo: invoice.invoiceNo,
      customerName: invoice.customerName,
      customerTpin: invoice.customerTpin || "",
      status: invoice.status,
      issueDate: invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : "",
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "",
      subtotal: invoice.subtotal,
      vatRate: invoice.vatRate,
      vatAmount: invoice.vatAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balance: invoice.balance
    });
  });

  return workbook;
}

function buildReportsWorkbook(summary, series) {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Value", key: "value", width: 18 }
  ];

  Object.entries(summary).forEach(([key, value]) => {
    summarySheet.addRow({ metric: key, value });
  });

  const seriesSheet = workbook.addWorksheet("Monthly");
  seriesSheet.columns = [
    { header: "Month", key: "month", width: 12 },
    { header: "Billed", key: "billed", width: 14 },
    { header: "Paid", key: "paid", width: 14 },
    { header: "Expenses", key: "expenses", width: 14 }
  ];

  series.forEach((row) => {
    seriesSheet.addRow({
      month: row.month,
      billed: row.billed,
      paid: row.paid,
      expenses: row.expenses
    });
  });

  return workbook;
}

function buildProjectExpensesWorkbook(expenses, openingBalance) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Project Expenses");

  sheet.columns = [
    { header: "DATE", key: "date", width: 14 },
    { header: "ITEM", key: "item", width: 44 },
    { header: "PRICE", key: "priceCurrency", width: 8 },
    { header: "", key: "priceAmount", width: 14 },
    { header: "TOTAL PER DAY", key: "totalCurrency", width: 10 },
    { header: "", key: "totalAmount", width: 16 }
  ];

  sheet.mergeCells(1, 3, 1, 4);
  sheet.mergeCells(1, 5, 1, 6);

  sheet.getCell("A1").value = "DATE";
  sheet.getCell("B1").value = "ITEM";
  sheet.getCell("C1").value = "PRICE";
  sheet.getCell("E1").value = "TOTAL PER DAY";

  const headerCells = ["A1", "B1", "C1", "D1", "E1", "F1"];
  headerCells.forEach((cellRef) => {
    const cell = sheet.getCell(cellRef);
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const groups = new Map();
  expenses.forEach((expense) => {
    const date = new Date(expense.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(expense);
  });

  const orderedKeys = Array.from(groups.keys()).sort();
  const totalsByDay = orderedKeys.map((key) => {
    const list = groups.get(key) || [];
    const total = list.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    return total;
  });

  const totalAll = totalsByDay.reduce((sum, val) => sum + val, 0);
  let runningBalance = Number.isFinite(openingBalance) ? openingBalance : totalAll;

  const yellowFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF00" } };

  orderedKeys.forEach((key, idx) => {
    const list = groups.get(key) || [];
    const [year, month, day] = key.split("-").map((val) => Number(val));
    const dateObj = new Date(year, month - 1, day);
    const dateLabel = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    const dayTotal = list.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

    const dateRow = sheet.addRow([
      dateLabel,
      "EXPENES",
      "",
      "",
      idx === 0 ? "ZMW" : "",
      idx === 0 ? runningBalance : ""
    ]);
    dateRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = yellowFill;
      cell.font = { bold: true };
    });

    if (idx === 0) {
      const totalCell = dateRow.getCell(6);
      totalCell.numFmt = "#,##0.00";
      totalCell.alignment = { horizontal: "right" };
    }

    if (list.length === 0) {
      const emptyRow = sheet.addRow([dayName, "", "", "", "", ""]);
      emptyRow.getCell(1).font = { bold: true };
    } else {
      list.forEach((expense, expIndex) => {
        const row = sheet.addRow([
          expIndex === 0 ? dayName : "",
          expense.title,
          "",
          Number(expense.amount) || 0,
          "",
          ""
        ]);
        row.getCell(1).font = expIndex === 0 ? { bold: true } : undefined;
        row.getCell(4).numFmt = '"K"#,##0.00';
        row.getCell(4).alignment = { horizontal: "right" };
      });
    }

    const totalRow = sheet.addRow(["", "TOTAL", "ZMW", dayTotal, "", ""]);
    totalRow.getCell(2).font = { bold: true };
    totalRow.getCell(3).font = { bold: true };
    totalRow.getCell(4).numFmt = "#,##0.00";
    totalRow.getCell(4).alignment = { horizontal: "right" };

    runningBalance -= dayTotal;
    const balanceRow = sheet.addRow(["", "BALANCE", "", "", "ZMW", runningBalance]);
    balanceRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = yellowFill;
      cell.font = { bold: true };
    });
    balanceRow.getCell(6).numFmt = "#,##0.00";
    balanceRow.getCell(6).alignment = { horizontal: "right" };
  });

  sheet.eachRow((row) => {
    for (let col = 1; col <= 6; col += 1) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin", color: { argb: "D0D0D0" } },
        left: { style: "thin", color: { argb: "D0D0D0" } },
        bottom: { style: "thin", color: { argb: "D0D0D0" } },
        right: { style: "thin", color: { argb: "D0D0D0" } }
      };
    }
  });

  return workbook;
}

module.exports = { buildQuotesWorkbook, buildInvoicesWorkbook, buildReportsWorkbook, buildProjectExpensesWorkbook };
