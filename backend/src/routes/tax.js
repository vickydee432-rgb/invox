const express = require("express");
const { z } = require("zod");
const TaxCode = require("../models/TaxCode");
const TaxReturn = require("../models/TaxReturn");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { handleRouteError } = require("./_helpers");

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

module.exports = router;
