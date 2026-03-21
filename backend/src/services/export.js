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

function buildSalesWorkbook(sales) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales");

  sheet.columns = [
    { header: "Sale No", key: "saleNo", width: 14 },
    { header: "Customer", key: "customerName", width: 22 },
    { header: "Customer Phone", key: "customerPhone", width: 16 },
    { header: "Customer TPIN", key: "customerTpin", width: 18 },
    { header: "Branch", key: "branchName", width: 18 },
    { header: "Status", key: "status", width: 12 },
    { header: "Issue Date", key: "issueDate", width: 14 },
    { header: "Subtotal", key: "subtotal", width: 12 },
    { header: "VAT Rate", key: "vatRate", width: 10 },
    { header: "VAT Amount", key: "vatAmount", width: 12 },
    { header: "Total", key: "total", width: 12 },
    { header: "Paid", key: "amountPaid", width: 12 },
    { header: "Balance", key: "balance", width: 12 }
  ];

  sales.forEach((sale) => {
    sheet.addRow({
      saleNo: sale.saleNo,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone || "",
      customerTpin: sale.customerTpin || "",
      branchName: sale.branchName || "",
      status: sale.status,
      issueDate: sale.issueDate ? new Date(sale.issueDate).toLocaleDateString() : "",
      subtotal: sale.subtotal,
      vatRate: sale.vatRate,
      vatAmount: sale.vatAmount,
      total: sale.total,
      amountPaid: sale.amountPaid,
      balance: sale.balance
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
  const hasSales = (series || []).some((row) => row.sales !== undefined || row.salesPaid !== undefined);
  seriesSheet.columns = [
    { header: "Month", key: "month", width: 12 },
    { header: "Billed", key: "billed", width: 14 },
    { header: "Paid", key: "paid", width: 14 },
    ...(hasSales
      ? [
          { header: "Sales", key: "sales", width: 14 },
          { header: "Sales Paid", key: "salesPaid", width: 14 }
        ]
      : []),
    { header: "Expenses", key: "expenses", width: 14 }
  ];

  series.forEach((row) => {
    seriesSheet.addRow({
      month: row.month,
      billed: row.billed,
      paid: row.paid,
      sales: row.sales ?? 0,
      salesPaid: row.salesPaid ?? 0,
      expenses: row.expenses
    });
  });

  return workbook;
}

function buildDetailedExpensesWorkbook(expenses, options = {}) {
  const { openingBalance, summary, currency = "ZMW", amountNumFmt = "#,##0.00" } = options;
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

  if (summary) {
    if (summary.funding !== undefined) sheet.getCell("G3").value = summary.labels?.funding || "PROJECT FUNDNG";
    if (Number.isFinite(summary.funding)) sheet.getCell("H3").value = summary.funding;
    if (summary.available !== undefined) sheet.getCell("G4").value = summary.labels?.available || "AVALIBLE";
    if (Number.isFinite(summary.available)) sheet.getCell("H4").value = summary.available;
    if (summary.totalSpent !== undefined) sheet.getCell("G5").value = summary.labels?.totalSpent || "TOTAL SPENT";
    if (Number.isFinite(summary.totalSpent)) sheet.getCell("H5").value = summary.totalSpent;
    ["H3", "H4", "H5"].forEach((cellRef) => {
      const cell = sheet.getCell(cellRef);
      if (typeof cell.value === "number") cell.numFmt = amountNumFmt;
    });
  }

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
      idx === 0 ? currency : "",
      idx === 0 ? runningBalance : ""
    ]);
    dateRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = yellowFill;
      cell.font = { bold: true };
    });

    if (idx === 0) {
      const totalCell = dateRow.getCell(6);
      totalCell.numFmt = amountNumFmt;
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
        row.getCell(4).numFmt = amountNumFmt;
        row.getCell(4).alignment = { horizontal: "right" };
      });
    }

    const totalRow = sheet.addRow(["", "TOTAL", currency, dayTotal, "", ""]);
    totalRow.getCell(2).font = { bold: true };
    totalRow.getCell(3).font = { bold: true };
    totalRow.getCell(4).numFmt = amountNumFmt;
    totalRow.getCell(4).alignment = { horizontal: "right" };

    runningBalance -= dayTotal;
    const balanceRow = sheet.addRow(["", "BALANCE", "", "", currency, runningBalance]);
    balanceRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = yellowFill;
      cell.font = { bold: true };
    });
    balanceRow.getCell(6).numFmt = amountNumFmt;
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

function buildProjectExpensesWorkbook(expenses, openingBalance) {
  return buildDetailedExpensesWorkbook(expenses, {
    openingBalance,
    currency: "ZMW",
    amountNumFmt: '"K"#,##0.00'
  });
}

function buildExpensesWorkbook(expenses, options = {}) {
  return buildDetailedExpensesWorkbook(expenses, options);
}

function buildFinancialIncomeStatementWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 26 },
    { header: "Value", key: "value", width: 22 }
  ];

  summarySheet.addRow({ metric: "From", value: report?.range?.from || "" });
  summarySheet.addRow({ metric: "To", value: report?.range?.to || "" });
  summarySheet.addRow({ metric: "Total Revenue", value: report?.totals?.totalRevenue || 0 });
  summarySheet.addRow({ metric: "Total Expenses", value: report?.totals?.totalExpenses || 0 });
  summarySheet.addRow({ metric: "Net Profit", value: report?.totals?.netProfit || 0 });
  if (report?.comparison) {
    summarySheet.addRow({ metric: "Prev Revenue", value: report.comparison.previousTotals?.totalRevenue || 0 });
    summarySheet.addRow({ metric: "Prev Expenses", value: report.comparison.previousTotals?.totalExpenses || 0 });
    summarySheet.addRow({ metric: "Prev Net Profit", value: report.comparison.previousTotals?.netProfit || 0 });
    summarySheet.addRow({ metric: "Δ Revenue", value: report.comparison.deltas?.revenue || 0 });
    summarySheet.addRow({ metric: "Δ Expenses", value: report.comparison.deltas?.expenses || 0 });
    summarySheet.addRow({ metric: "Δ Net Profit", value: report.comparison.deltas?.netProfit || 0 });
  }

  const revenueSheet = workbook.addWorksheet("Revenue (Invoices)");
  revenueSheet.columns = [
    { header: "Invoice No", key: "invoiceNo", width: 16 },
    { header: "Customer", key: "customerName", width: 24 },
    { header: "Issue Date", key: "issueDate", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Total", key: "total", width: 14 },
    { header: "Paid", key: "amountPaid", width: 14 },
    { header: "Balance", key: "balance", width: 14 }
  ];
  (report?.breakdown?.revenueByInvoice || []).forEach((inv) => {
    revenueSheet.addRow({
      invoiceNo: inv.invoiceNo || "",
      customerName: inv.customerName || "",
      issueDate: inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : "",
      status: inv.status || "",
      total: inv.total || 0,
      amountPaid: inv.amountPaid || 0,
      balance: inv.balance || 0
    });
  });

  const expenseSheet = workbook.addWorksheet("Expenses (Categories)");
  expenseSheet.columns = [
    { header: "Category", key: "category", width: 26 },
    { header: "Total", key: "total", width: 18 },
    { header: "Count", key: "count", width: 10 }
  ];
  (report?.breakdown?.expensesByCategory || []).forEach((row) => {
    expenseSheet.addRow({ category: row.category || "Uncategorized", total: row.total || 0, count: row.count || 0 });
  });

  const seriesSheet = workbook.addWorksheet("Series");
  seriesSheet.columns = [
    { header: "Period", key: "period", width: 12 },
    { header: "Revenue", key: "revenue", width: 14 },
    { header: "Expenses", key: "expenses", width: 14 },
    { header: "Profit", key: "profit", width: 14 }
  ];
  (report?.series || []).forEach((row) => {
    seriesSheet.addRow({
      period: row.period,
      revenue: row.revenue || 0,
      expenses: row.expenses || 0,
      profit: row.profit || 0
    });
  });

  return workbook;
}

function buildFinancialBalanceSheetWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Balance Sheet");
  sheet.columns = [
    { header: "Section", key: "section", width: 18 },
    { header: "Item", key: "item", width: 26 },
    { header: "Amount", key: "amount", width: 18 }
  ];

  sheet.addRow({ section: "Meta", item: "As At", amount: report?.asAt || "" });
  sheet.addRow({});
  sheet.addRow({ section: "Assets", item: "Cash", amount: report?.assets?.cash || 0 });
  sheet.addRow({ section: "Assets", item: "Accounts Receivable", amount: report?.assets?.accountsReceivable || 0 });
  sheet.addRow({ section: "Assets", item: "Total Assets", amount: report?.assets?.total || 0 });
  sheet.addRow({});
  sheet.addRow({ section: "Liabilities", item: "Obligations", amount: report?.liabilities?.obligations || 0 });
  sheet.addRow({ section: "Liabilities", item: "Total Liabilities", amount: report?.liabilities?.total || 0 });
  sheet.addRow({});
  sheet.addRow({ section: "Equity", item: "Owner Equity", amount: report?.equity?.ownerEquity || 0 });
  sheet.addRow({ section: "Equity", item: "Retained Earnings", amount: report?.equity?.retainedEarnings || 0 });
  sheet.addRow({ section: "Equity", item: "Total Equity", amount: report?.equity?.total || 0 });
  sheet.addRow({});
  sheet.addRow({ section: "Meta", item: "Balanced", amount: report?.balanced ? "true" : "false" });
  sheet.addRow({ section: "Meta", item: "Balance Diff", amount: report?.balanceDiff || 0 });

  return workbook;
}

function buildFinancialCashFlowWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cash Flow");
  sheet.columns = [
    { header: "Metric", key: "metric", width: 24 },
    { header: "Value", key: "value", width: 22 }
  ];
  sheet.addRow({ metric: "From", value: report?.range?.from || "" });
  sheet.addRow({ metric: "To", value: report?.range?.to || "" });
  sheet.addRow({});
  sheet.addRow({ metric: "Cash In", value: report?.cashIn || 0 });
  sheet.addRow({ metric: "Cash Out", value: report?.cashOut || 0 });
  sheet.addRow({ metric: "Net Cash Flow", value: report?.netCashFlow || 0 });
  sheet.addRow({ metric: "Opening Cash", value: report?.openingCash || 0 });
  sheet.addRow({ metric: "Closing Cash", value: report?.closingCash || 0 });
  sheet.addRow({ metric: "Cash Source", value: report?.cashSource || "" });
  return workbook;
}

module.exports = {
  buildQuotesWorkbook,
  buildInvoicesWorkbook,
  buildSalesWorkbook,
  buildReportsWorkbook,
  buildProjectExpensesWorkbook,
  buildExpensesWorkbook,
  buildFinancialIncomeStatementWorkbook,
  buildFinancialBalanceSheetWorkbook,
  buildFinancialCashFlowWorkbook
};
