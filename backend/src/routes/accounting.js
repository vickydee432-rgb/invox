const express = require("express");
const { z } = require("zod");
const Account = require("../models/Account");
const Journal = require("../models/Journal");
const JournalLine = require("../models/JournalLine");
const Period = require("../models/Period");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { ensureObjectId, handleRouteError } = require("./_helpers");
const { createJournal } = require("../services/ledger");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("accounting"));

const AccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["Asset", "Liability", "Equity", "Income", "Expense"]),
  subType: z.string().optional(),
  parentId: z.string().optional(),
  isControl: z.boolean().optional()
});

router.get("/accounts", async (req, res) => {
  try {
    const accounts = await Account.find({ companyId: req.user.companyId }).sort({ code: 1 }).lean();
    res.json({ accounts });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load accounts");
  }
});

router.post("/accounts", async (req, res) => {
  try {
    const parsed = AccountSchema.parse(req.body);
    if (parsed.parentId) ensureObjectId(parsed.parentId, "parent id");
    const account = await Account.create({
      companyId: req.user.companyId,
      code: parsed.code.trim(),
      name: parsed.name.trim(),
      type: parsed.type,
      subType: parsed.subType,
      parentId: parsed.parentId || null,
      isControl: parsed.isControl ?? false
    });
    res.status(201).json({ account });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create account");
  }
});

const PeriodSchema = z.object({
  name: z.string().min(2),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  fiscalYearId: z.string().optional()
});

router.get("/periods", async (req, res) => {
  try {
    const periods = await Period.find({ companyId: req.user.companyId }).sort({ startDate: -1 }).lean();
    res.json({ periods });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load periods");
  }
});

router.post("/periods", async (req, res) => {
  try {
    const parsed = PeriodSchema.parse(req.body);
    if (parsed.fiscalYearId) ensureObjectId(parsed.fiscalYearId, "fiscal year id");
    const period = await Period.create({
      companyId: req.user.companyId,
      fiscalYearId: parsed.fiscalYearId || null,
      name: parsed.name,
      startDate: new Date(parsed.startDate),
      endDate: new Date(parsed.endDate),
      isClosed: false
    });
    res.status(201).json({ period });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create period");
  }
});

router.post("/periods/close", async (req, res) => {
  try {
    const { periodId } = req.body || {};
    ensureObjectId(periodId, "period id");
    const period = await Period.findOne({ _id: periodId, companyId: req.user.companyId });
    if (!period) return res.status(404).json({ error: "Period not found" });
    period.isClosed = true;
    await period.save();
    res.json({ period });
  } catch (err) {
    return handleRouteError(res, err, "Failed to close period");
  }
});

const JournalSchema = z.object({
  date: z.string().min(1),
  memo: z.string().optional(),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1),
        debit: z.number().nonnegative().optional(),
        credit: z.number().nonnegative().optional()
      })
    )
    .min(2)
});

router.get("/journals", async (req, res) => {
  try {
    const journals = await Journal.find({ companyId: req.user.companyId })
      .sort({ date: -1 })
      .limit(200)
      .lean();
    res.json({ journals });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load journals");
  }
});

router.post("/journals", async (req, res) => {
  try {
    const parsed = JournalSchema.parse(req.body);
    const date = new Date(parsed.date);
    const lines = parsed.lines.map((line) => ({
      accountId: line.accountId,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0)
    }));
    const journal = await createJournal({
      companyId: req.user.companyId,
      date,
      refType: "manual",
      memo: parsed.memo,
      lines,
      currency: null,
      postedBy: req.user._id
    });
    res.status(201).json({ journal });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create journal");
  }
});

router.get("/trial-balance", async (req, res) => {
  try {
    const { periodId } = req.query;
    const match = { companyId: req.user.companyId };
    if (periodId) {
      ensureObjectId(String(periodId), "period id");
      const journals = await Journal.find({ companyId: req.user.companyId, periodId }).select("_id").lean();
      const journalIds = journals.map((j) => j._id);
      match.journalId = { $in: journalIds };
    }

    const rows = await JournalLine.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$accountId",
          debit: { $sum: "$debit" },
          credit: { $sum: "$credit" }
        }
      }
    ]);
    res.json({ rows });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load trial balance");
  }
});

module.exports = router;
