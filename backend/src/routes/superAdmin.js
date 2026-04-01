const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const { handleRouteError, parseOptionalDate } = require("./_helpers");
const { getSuperAdminOverview, getSuperAdminAlerts } = require("../services/superAdminReporting");

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

module.exports = router;
