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
const User = require("../models/User");
const Company = require("../models/Company");

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(["super_admin"]));

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

function resolveCompanyScope(req) {
  // Company-scoped Super Admin: always restrict to the super admin user's company.
  return req.user?.companyId || null;
}

function requireCompanyScope(req) {
  const companyId = resolveCompanyScope(req);
  if (!companyId) {
    const err = new Error("Missing company scope");
    err.status = 400;
    throw err;
  }
  return companyId;
}

router.get("/overview", async (req, res) => {
  try {
    const fromDate = parseDateParam(req.query.from, "from");
    const toDate = parseDateParam(req.query.to, "to", { endOfDay: true });
    const groupBy = parseGroupBy(req.query.groupBy);

    const companyId = requireCompanyScope(req);

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
    const companyId = requireCompanyScope(req);
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
    const companyId = requireCompanyScope(req);
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
    const overview = await getSuperAdminOverview({
      companyId: requireCompanyScope(req),
      fromDate: parseDateParam(req.query.from, "from"),
      toDate: parseDateParam(req.query.to, "to", { endOfDay: true }),
      groupBy: parseGroupBy(req.query.groupBy)
    });
    const topEmployees = overview.employeePerformance.slice(0, Number(req.query.limit || 30));
    res.json({ employees: topEmployees });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load employee leaderboard");
  }
});

router.get("/branch-performance", async (req, res) => {
  try {
    const overview = await getSuperAdminOverview({
      companyId: requireCompanyScope(req),
      fromDate: parseDateParam(req.query.from, "from"),
      toDate: parseDateParam(req.query.to, "to", { endOfDay: true }),
      groupBy: parseGroupBy(req.query.groupBy)
    });
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
    const companyId = requireCompanyScope(req);
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
    const companyId = requireCompanyScope(req);
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
    const companyId = requireCompanyScope(req);
    const data = await getSuperAdminIncomeStatement({ companyId, fromDate, toDate, groupBy });
    return generateIncomeStatementPdf(res, data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to export income statement");
  }
});

// Super Admin Console - User Management
router.get("/console/users", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.min(50, Number(req.query.limit || 20));
    const companyId = requireCompanyScope(req);
    const query = { companyId };

    if (q) {
      query.$or = [
        { email: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } }
      ];
    }

    const users = await User.find(query)
      .select("_id name email role createdAt lastLoginAt companyId")
      .populate("companyId", "name")
      .sort({ lastLoginAt: -1 })
      .limit(limit)
      .lean();

    res.json({ users });
  } catch (err) {
    return handleRouteError(res, err, "Failed to search users");
  }
});

router.get("/console/users/:userId", async (req, res) => {
  try {
    const companyId = requireCompanyScope(req);
    const user = await User.findById(req.params.userId)
      .select("_id name email phone role createdAt lastLoginAt mfaEnabled companyId")
      .populate("companyId", "name")
      .lean();

    if (!user) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    if (String(user.companyId?._id || user.companyId) !== String(companyId)) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    res.json({ user });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load user details");
  }
});

router.post("/console/login-as", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      const err = new Error("userId is required");
      err.status = 400;
      throw err;
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      const err = new Error("Target user not found");
      err.status = 404;
      throw err;
    }

    const companyId = requireCompanyScope(req);
    if (String(targetUser.companyId) !== String(companyId)) {
      const err = new Error("Target user not found");
      err.status = 404;
      throw err;
    }

    // Create an impersonation token with the target user's ID
    const secret = process.env.AUTH_JWT_SECRET;
    const ttl = process.env.AUTH_TOKEN_TTL || "7d";
    const token = require("jsonwebtoken").sign(
      { sub: targetUser._id.toString(), email: targetUser.email },
      secret,
      { expiresIn: ttl }
    );

    // Log this impersonation attempt in audit log (optional)
    const AuditLog = require("../models/AuditLog");
    if (AuditLog) {
      await AuditLog.create({
        companyId: req.user.companyId,
        userId: req.user._id,
        action: "super_admin_impersonate",
        details: {
          impersonatedUserId: targetUser._id,
          impersonatedUserEmail: targetUser.email,
          targetUserCompanyId: targetUser.companyId
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
    }

    res.json({ token, user: { _id: targetUser._id, name: targetUser.name, email: targetUser.email, role: targetUser.role } });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create impersonation session");
  }
});

router.get("/console/companies", async (req, res) => {
  try {
    const companyId = requireCompanyScope(req);

    const company = await Company.findById(companyId)
      .select(
        "_id name email currency businessType subscriptionStatus subscriptionPlan subscriptionCycle trialEndsAt currentPeriodEnd createdAt"
      )
      .lean();

    res.json({ companies: company ? [company] : [] });
  } catch (err) {
    return handleRouteError(res, err, "Failed to search companies");
  }
});

module.exports = router;
