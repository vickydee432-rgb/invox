const express = require("express");
const { z } = require("zod");
const AuditLog = require("../models/AuditLog");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requirePermission } = require("../middleware/permissions");
const { parseOptionalDate, parseLimit, parsePage, handleRouteError } = require("./_helpers");

const router = express.Router();
router.use(requireAuth, requireSubscription, requirePermission("audit:read"));

const QuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  entityType: z.string().optional(),
  limit: z.string().optional(),
  page: z.string().optional()
});

router.get("/", async (req, res) => {
  try {
    const parsed = QuerySchema.parse(req.query);
    const fromDate = parseOptionalDate(parsed.from, "from");
    const toDate = parseOptionalDate(parsed.to, "to");
    const term = String(parsed.q || "").trim();

    const filter = { companyId: req.user.companyId };
    if (parsed.entityType) filter.entityType = String(parsed.entityType);

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = fromDate;
      if (toDate) filter.createdAt.$lte = toDate;
    }

    if (term) {
      filter.$or = [
        { action: { $regex: term, $options: "i" } },
        { actorEmail: { $regex: term, $options: "i" } },
        { entityType: { $regex: term, $options: "i" } },
        { entityId: { $regex: term, $options: "i" } }
      ];
    }

    const safeLimit = parseLimit(parsed.limit, { defaultLimit: 100, maxLimit: 300 });
    const page = parsePage(parsed.page);
    const skip = (page - 1) * safeLimit;
    const total = await AuditLog.countDocuments(filter);
    const rows = await AuditLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page, limit: safeLimit, total, pages, count: rows.length, logs: rows });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load audit logs");
  }
});

module.exports = router;

