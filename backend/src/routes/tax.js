const express = require("express");
const { z } = require("zod");
const TaxCode = require("../models/TaxCode");
const TaxReturn = require("../models/TaxReturn");
const TaxDeadline = require("../models/TaxDeadline");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { handleRouteError, ensureObjectId, parseOptionalDate } = require("./_helpers");
const { ensureTaxDeadlinesForCompany } = require("../services/taxDeadlines");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("tax"));

const TaxCodeSchema = z.object({
  name: z.string().min(2),
  rate: z.number().nonnegative(),
  type: z.enum(["VAT", "Turnover", "Withholding"])
});

router.get("/tax-codes", async (req, res) => {
  try {
    const codes = await TaxCode.find({ companyId: req.user.companyId }).sort({ name: 1 }).lean();
    res.json({ codes });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load tax codes");
  }
});

router.post("/tax-codes", async (req, res) => {
  try {
    const parsed = TaxCodeSchema.parse(req.body);
    const code = await TaxCode.create({ companyId: req.user.companyId, ...parsed });
    res.status(201).json({ code });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create tax code");
  }
});

const TaxReturnSchema = z.object({
  period: z.string().min(1),
  type: z.enum(["VAT", "Turnover", "Withholding"]),
  totals: z.record(z.any()).optional()
});

router.get("/tax-returns", async (req, res) => {
  try {
    const { period } = req.query;
    const filter = { companyId: req.user.companyId };
    if (period) filter.period = String(period);
    const returns = await TaxReturn.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ returns });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load tax returns");
  }
});

router.post("/tax-returns/submit", async (req, res) => {
  try {
    const parsed = TaxReturnSchema.parse(req.body);
    const doc = await TaxReturn.findOneAndUpdate(
      { companyId: req.user.companyId, period: parsed.period, type: parsed.type },
      {
        companyId: req.user.companyId,
        period: parsed.period,
        type: parsed.type,
        status: "submitted",
        totals: parsed.totals || {}
      },
      { upsert: true, new: true }
    );
    res.status(201).json({ taxReturn: doc });
  } catch (err) {
    return handleRouteError(res, err, "Failed to submit tax return");
  }
});

const DeadlineCreateSchema = z.object({
  taxType: z.enum(["income_annual", "provisional", "paye", "vat", "wht", "turnover", "custom"]),
  title: z.string().min(2),
  dueDate: z.string().min(4),
  notifyDaysBefore: z.array(z.number().int().min(0).max(365)).optional(),
  channels: z
    .object({
      inApp: z.boolean().optional(),
      email: z.boolean().optional(),
      sms: z.boolean().optional()
    })
    .optional(),
  notes: z.string().optional()
});

const DeadlineUpdateSchema = DeadlineCreateSchema.partial().extend({
  status: z.enum(["pending", "filed", "paid", "skipped"]).optional()
});

router.post("/deadlines/seed", async (req, res) => {
  try {
    await ensureTaxDeadlinesForCompany(req.user.companyId, String(req.user.companyId));
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to seed tax deadlines");
  }
});

router.get("/deadlines", async (req, res) => {
  try {
    const from = parseOptionalDate(req.query.from, "from");
    const to = parseOptionalDate(req.query.to, "to");
    const status = String(req.query.status || "").trim();
    const filter = {
      companyId: req.user.companyId
    };
    if (status) filter.status = status;
    if (from || to) {
      filter.dueDate = {};
      if (from) filter.dueDate.$gte = from;
      if (to) filter.dueDate.$lte = to;
    } else {
      // default window: next 120 days + overdue
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 120);
      filter.dueDate = { $lte: end };
    }

    const deadlines = await TaxDeadline.find(filter).sort({ dueDate: 1 }).limit(500).lean();
    res.json({ deadlines });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load tax deadlines");
  }
});

router.post("/deadlines", async (req, res) => {
  try {
    const parsed = DeadlineCreateSchema.parse(req.body || {});
    const dueDate = parseOptionalDate(parsed.dueDate, "dueDate");
    if (!dueDate) return res.status(400).json({ error: "Invalid dueDate" });
    const deadline = await TaxDeadline.create({
      companyId: req.user.companyId,
      workspaceId: String(req.user.companyId),
      taxType: parsed.taxType,
      title: parsed.title,
      dueDate,
      notifyDaysBefore: parsed.notifyDaysBefore || [],
      channels: {
        inApp: parsed.channels?.inApp ?? true,
        email: parsed.channels?.email ?? false,
        sms: parsed.channels?.sms ?? false
      },
      notes: parsed.notes
    });
    res.status(201).json({ deadline });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create tax deadline");
  }
});

router.patch("/deadlines/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "deadline id");
    const parsed = DeadlineUpdateSchema.parse(req.body || {});
    const deadline = await TaxDeadline.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!deadline) return res.status(404).json({ error: "Deadline not found" });
    if (parsed.taxType !== undefined) deadline.taxType = parsed.taxType;
    if (parsed.title !== undefined) deadline.title = parsed.title;
    if (parsed.dueDate !== undefined) {
      const d = parseOptionalDate(parsed.dueDate, "dueDate");
      if (!d) return res.status(400).json({ error: "Invalid dueDate" });
      deadline.dueDate = d;
    }
    if (parsed.notifyDaysBefore !== undefined) deadline.notifyDaysBefore = parsed.notifyDaysBefore;
    if (parsed.channels !== undefined) {
      deadline.channels = {
        inApp: parsed.channels.inApp ?? deadline.channels?.inApp ?? true,
        email: parsed.channels.email ?? deadline.channels?.email ?? false,
        sms: parsed.channels.sms ?? deadline.channels?.sms ?? false
      };
    }
    if (parsed.status !== undefined) deadline.status = parsed.status;
    if (parsed.notes !== undefined) deadline.notes = parsed.notes;
    await deadline.save();
    res.json({ deadline });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update tax deadline");
  }
});

module.exports = router;
