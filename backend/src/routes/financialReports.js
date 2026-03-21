const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { handleRouteError } = require("./_helpers");
const { resolveWorkspaceId } = require("../services/scope");
const {
  getDashboard,
  getIncomeStatementWithComparison,
  getBalanceSheet,
  getCashFlow
} = require("../services/financialReporting");
const {
  buildFinancialIncomeStatementWorkbook,
  buildFinancialBalanceSheetWorkbook,
  buildFinancialCashFlowWorkbook
} = require("../services/export");
const {
  generateIncomeStatementPdf,
  generateBalanceSheetPdf,
  generateCashFlowPdf
} = require("../services/financialReportPdf");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("reports"));

function parseDateOnly(value) {
  const str = String(value || "").trim();
  if (!str) return null;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function parseDateParam(value, label, { endOfDay = false } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value).trim();
  const dateOnly = parseDateOnly(raw);
  if (dateOnly) {
    const { year, month, day } = dateOnly;
    const dt = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (endOfDay) dt.setUTCHours(23, 59, 59, 999);
    return dt;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    const err = new Error(`Invalid ${label}`);
    err.status = 400;
    throw err;
  }
  return date;
}

function parseGroupBy(value) {
  const v = String(value || "month").toLowerCase();
  if (v === "month" || v === "quarter" || v === "year") return v;
  const err = new Error("Invalid groupBy (use month|quarter|year)");
  err.status = 400;
  throw err;
}

function asCsv(rows) {
  const escape = (val) => {
    const text = val === null || val === undefined ? "" : String(val);
    if (text.includes('"') || text.includes(",") || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return rows.map((row) => row.map(escape).join(",")).join("\n") + "\n";
}

router.get("/dashboard", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);
    const data = await getDashboard(req.user.companyId, workspaceId, { fromDate, toDate, groupBy });
    res.json(data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to load financial dashboard");
  }
});

router.get("/income-statement", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);
    const limit = req.query.limit ? Number(req.query.limit) : 200;
    const data = await getIncomeStatementWithComparison(req.user.companyId, workspaceId, {
      fromDate,
      toDate,
      groupBy,
      limit
    });
    res.json(data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to build income statement");
  }
});

router.get("/balance-sheet", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const asAt = parseDateParam(req.query.asAt || req.query.to, "asAt", { endOfDay: true }) || new Date();
    const data = await getBalanceSheet(req.user.companyId, workspaceId, { asAt });
    res.json(data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to build balance sheet");
  }
});

router.get("/cash-flow", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const data = await getCashFlow(req.user.companyId, workspaceId, { fromDate, toDate });
    res.json(data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to build cash flow");
  }
});

router.get("/income-statement/export.csv", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);
    const data = await getIncomeStatementWithComparison(req.user.companyId, workspaceId, { fromDate, toDate, groupBy, limit: 1000 });

    const header = [
      ["Report", "Income Statement"],
      ["From", data.range.from || ""],
      ["To", data.range.to || ""],
      [],
      ["Total Revenue", data.totals.totalRevenue],
      ["Total Expenses", data.totals.totalExpenses],
      ["Net Profit", data.totals.netProfit],
      [],
      ["Revenue By Invoice"],
      ["Invoice No", "Customer", "Issue Date", "Status", "Total", "Paid", "Balance"]
    ];
    const invoiceRows = (data.breakdown?.revenueByInvoice || []).map((inv) => [
      inv.invoiceNo || "",
      inv.customerName || "",
      inv.issueDate ? new Date(inv.issueDate).toISOString() : "",
      inv.status || "",
      inv.total || 0,
      inv.amountPaid || 0,
      inv.balance || 0
    ]);
    const expenseHeader = [[], ["Expenses By Category"], ["Category", "Total", "Count"]];
    const expenseRows = (data.breakdown?.expensesByCategory || []).map((row) => [row.category, row.total || 0, row.count || 0]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="income_statement.csv"');
    res.send(asCsv([...header, ...invoiceRows, ...expenseHeader, ...expenseRows]));
  } catch (err) {
    return handleRouteError(res, err, "Failed to export income statement");
  }
});

router.get("/income-statement/export.xlsx", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);
    const data = await getIncomeStatementWithComparison(req.user.companyId, workspaceId, { fromDate, toDate, groupBy, limit: 1000 });

    const workbook = buildFinancialIncomeStatementWorkbook(data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="income_statement.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export income statement");
  }
});

router.get("/income-statement/export.pdf", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);
    const data = await getIncomeStatementWithComparison(req.user.companyId, workspaceId, { fromDate, toDate, groupBy, limit: 1000 });
    return generateIncomeStatementPdf(res, data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to export income statement");
  }
});

router.get("/balance-sheet/export.csv", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const asAt = parseDateParam(req.query.asAt || req.query.to, "asAt", { endOfDay: true }) || new Date();
    const data = await getBalanceSheet(req.user.companyId, workspaceId, { asAt });

    const rows = [
      ["Report", "Balance Sheet"],
      ["As At", data.asAt],
      [],
      ["Assets", "", ""],
      ["Cash", data.assets.cash],
      ["Accounts Receivable", data.assets.accountsReceivable],
      ["Total Assets", data.assets.total],
      [],
      ["Liabilities", "", ""],
      ["Obligations", data.liabilities.obligations],
      ["Total Liabilities", data.liabilities.total],
      [],
      ["Equity", "", ""],
      ["Owner Equity", data.equity.ownerEquity],
      ["Retained Earnings", data.equity.retainedEarnings],
      ["Total Equity", data.equity.total],
      [],
      ["Balanced", data.balanced ? "true" : "false"],
      ["Balance Diff", data.balanceDiff]
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="balance_sheet.csv"');
    res.send(asCsv(rows));
  } catch (err) {
    return handleRouteError(res, err, "Failed to export balance sheet");
  }
});

router.get("/balance-sheet/export.xlsx", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const asAt = parseDateParam(req.query.asAt || req.query.to, "asAt", { endOfDay: true }) || new Date();
    const data = await getBalanceSheet(req.user.companyId, workspaceId, { asAt });
    const workbook = buildFinancialBalanceSheetWorkbook(data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="balance_sheet.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export balance sheet");
  }
});

router.get("/balance-sheet/export.pdf", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const asAt = parseDateParam(req.query.asAt || req.query.to, "asAt", { endOfDay: true }) || new Date();
    const data = await getBalanceSheet(req.user.companyId, workspaceId, { asAt });
    return generateBalanceSheetPdf(res, data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to export balance sheet");
  }
});

router.get("/cash-flow/export.csv", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const data = await getCashFlow(req.user.companyId, workspaceId, { fromDate, toDate });
    const rows = [
      ["Report", "Cash Flow Summary"],
      ["From", data.range.from || ""],
      ["To", data.range.to || ""],
      [],
      ["Cash In", data.cashIn],
      ["Cash Out", data.cashOut],
      ["Net Cash Flow", data.netCashFlow],
      ["Opening Cash", data.openingCash],
      ["Closing Cash", data.closingCash],
      ["Cash Source", data.cashSource]
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="cash_flow.csv"');
    res.send(asCsv(rows));
  } catch (err) {
    return handleRouteError(res, err, "Failed to export cash flow");
  }
});

router.get("/cash-flow/export.xlsx", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const data = await getCashFlow(req.user.companyId, workspaceId, { fromDate, toDate });
    const workbook = buildFinancialCashFlowWorkbook(data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="cash_flow.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export cash flow");
  }
});

router.get("/cash-flow/export.pdf", async (req, res) => {
  try {
    const workspaceId = resolveWorkspaceId(req);
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const data = await getCashFlow(req.user.companyId, workspaceId, { fromDate, toDate });
    return generateCashFlowPdf(res, data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to export cash flow");
  }
});

module.exports = router;

