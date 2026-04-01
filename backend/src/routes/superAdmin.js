const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const { handleRouteError, parseOptionalDate } = require("./_helpers");
const { getSuperAdminOverview, getSuperAdminAlerts, getSuperAdminIncomeStatement } = require("../services/superAdminReporting");
const {
  buildFinancialIncomeStatementWorkbook
} = require("../services/export");
const {
  generateIncomeStatementPdf
} = require("../services/financialReportPdf");

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(["super_admin", "owner"]));

function parseGroupBy(value) {
  const v = String(value || "month").toLowerCase();
  if (v === "day" || v === "week" || v === "month" || v === "quarter") return v;
  const err = new Error("Invalid groupBy (use day|week|month|quarter)");
  err.status = 400;
  throw err;
}

function parseDateParam(val, label, { endOfDay = false } = {}) {
  const date = parseOptionalDate(val, label);
  if (!date) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
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

router.get("/overview", async (req, res) => {
  try {
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);

    const companyId = req.query.companyId || null; // optional company scoped

    const data = await getSuperAdminOverview({ companyId, fromDate, toDate, groupBy });
    res.json(data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to load super admin overview");
  }
});

router.get("/alerts", async (req, res) => {
  try {
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const companyId = req.query.companyId || null;
    const data = await getSuperAdminAlerts({ companyId, fromDate, toDate });
    res.json({ alerts: data });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load super admin alerts");
  }
});

router.get("/reports/overview/export.csv", async (req, res) => {
  try {
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);
    const companyId = req.query.companyId || null;
    const data = await getSuperAdminOverview({ companyId, fromDate, toDate, groupBy });

    const headings = [
      ["Metric", "Value"],
      ["Total Revenue", data.overview.totalRevenue],
      ["Total Expenses", data.overview.totalExpenses],
      ["Net Profit", data.overview.netProfit],
      ["Invoices Count", data.overview.invoicesCount],
      ["Active Branches", data.overview.activeBranchesCount]
    ];

    const rows = data.branchPerformance.map((branch) => [
      `Branch: ${branch.branchName}`,
      `${branch.totalRevenue} (${branch.growthRate !== null ? branch.growthRate + "%" : "N/A"})`
    ]);

    const csv = [...headings, [], ["Branch report"], ["Branch Name", "TotalRevenue", "GrowthRate"]]
      .concat(data.branchPerformance.map((branch) => [branch.branchName, branch.totalRevenue, branch.growthRate]))
      .map((line) => line.map((v) => (v === null || v === undefined ? "" : String(v).replace(/"/g, '""'))).map((v) => `"${v}"`).join(","))
      .join("\n");

    res.setHeader("Content-Disposition", "attachment; filename=super-admin-overview.csv");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(csv);
  } catch (err) {
    return handleRouteError(res, err, "Failed to export super admin report");
  }
});

router.get("/employee-leaderboard", async (req, res) => {
  try {
    const overview = await getSuperAdminOverview({ fromDate: parseDateParam(req.query.from, "from"), toDate: parseDateParam(req.query.to, "to", { endOfDay: true }), groupBy: parseGroupBy(req.query.groupBy) });
    const topEmployees = overview.employeePerformance.slice(0, Number(req.query.limit || 30));
    res.json({ employees: topEmployees });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load employee leaderboard");
  }
});

router.get("/branch-performance", async (req, res) => {
  try {
    const overview = await getSuperAdminOverview({ fromDate: parseDateParam(req.query.from, "from"), toDate: parseDateParam(req.query.to, "to", { endOfDay: true }), groupBy: parseGroupBy(req.query.groupBy) });
    const branches = overview.branchPerformance;
    res.json({ branches });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load branch performance");
  }
});

router.get("/reports/income-statement/export.csv", async (req, res) => {
  try {
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);
    const companyId = req.query.companyId || null;
    const data = await getSuperAdminIncomeStatement({ companyId, fromDate, toDate, groupBy });

    const header = [
      ["Report", "Income Statement"],
      ["From", data.range.from || ""],
      ["To", data.range.to || ""],
      [],
      ["Total Revenue", data.totals.totalRevenue],
      ["Total Expenses", data.totals.totalExpenses],
      ["Net Profit", data.totals.netProfit],
      [],
      ["Series Data"],
      ["Period", "Revenue", "Expenses", "Profit"]
    ];
    const seriesRows = data.series.map((row) => [row.period, row.revenue, row.expenses, row.profit]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="super_admin_income_statement.csv"');
    res.send(asCsv([...header, ...seriesRows]));
  } catch (err) {
    return handleRouteError(res, err, "Failed to export income statement");
  }
});

router.get("/reports/income-statement/export.xlsx", async (req, res) => {
  try {
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);
    const companyId = req.query.companyId || null;
    const data = await getSuperAdminIncomeStatement({ companyId, fromDate, toDate, groupBy });

    const workbook = buildFinancialIncomeStatementWorkbook(data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="super_admin_income_statement.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export income statement");
  }
});

router.get("/reports/income-statement/export.pdf", async (req, res) => {
  try {
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);
    const companyId = req.query.companyId || null;
    const data = await getSuperAdminIncomeStatement({ companyId, fromDate, toDate, groupBy });
    return generateIncomeStatementPdf(res, data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to export income statement");
  }
});

module.exports = router;
