const express = require("express");
const { z } = require("zod");
const BankAccount = require("../models/BankAccount");
const BankTransaction = require("../models/BankTransaction");
const BankReconciliation = require("../models/BankReconciliation");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { ensureObjectId, handleRouteError } = require("./_helpers");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("banking"));

const BankAccountSchema = z.object({
  name: z.string().min(2),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  currency: z.string().optional()
});

router.get("/bank-accounts", async (req, res) => {
  try {
    const accounts = await BankAccount.find({ companyId: req.user.companyId }).sort({ name: 1 }).lean();
    res.json({ accounts });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load bank accounts");
  }
});

router.post("/bank-accounts", async (req, res) => {
  try {
    const parsed = BankAccountSchema.parse(req.body);
    const account = await BankAccount.create({ companyId: req.user.companyId, ...parsed });
    res.status(201).json({ account });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create bank account");
  }
});

const BankTransactionSchema = z.object({
  bankAccountId: z.string().min(1),
  date: z.string().min(1),
  amount: z.number(),
  description: z.string().optional(),
  reference: z.string().optional()
});

router.post("/bank-transactions/import", async (req, res) => {
  try {
    const parsed = z.array(BankTransactionSchema).parse(req.body?.transactions || []);
    parsed.forEach((row) => ensureObjectId(row.bankAccountId, "bank account id"));
    const docs = parsed.map((row) => ({
      companyId: req.user.companyId,
      bankAccountId: row.bankAccountId,
      date: new Date(row.date),
      amount: row.amount,
      description: row.description,
      reference: row.reference
    }));
    const created = await BankTransaction.insertMany(docs);
    res.status(201).json({ count: created.length });
  } catch (err) {
    return handleRouteError(res, err, "Failed to import bank transactions");
  }
});

const ReconciliationSchema = z.object({
  bankAccountId: z.string().min(1),
  period: z.string().min(1),
  closingBalance: z.number()
});

router.post("/bank-reconciliations", async (req, res) => {
  try {
    const parsed = ReconciliationSchema.parse(req.body);
    ensureObjectId(parsed.bankAccountId, "bank account id");
    const rec = await BankReconciliation.findOneAndUpdate(
      { companyId: req.user.companyId, bankAccountId: parsed.bankAccountId, period: parsed.period },
      {
        companyId: req.user.companyId,
        bankAccountId: parsed.bankAccountId,
        period: parsed.period,
        closingBalance: parsed.closingBalance,
        status: "closed"
      },
      { upsert: true, new: true }
    );
    res.status(201).json({ reconciliation: rec });
  } catch (err) {
    return handleRouteError(res, err, "Failed to reconcile bank account");
  }
});

router.post("/bank-matching", async (req, res) => {
  try {
    const { transactionId, refType, refId } = req.body || {};
    ensureObjectId(transactionId, "transaction id");
    const tx = await BankTransaction.findOne({ _id: transactionId, companyId: req.user.companyId });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    tx.matchedRefType = refType;
    tx.matchedRefId = refId || null;
    await tx.save();
    res.json({ transaction: tx });
  } catch (err) {
    return handleRouteError(res, err, "Failed to match payment");
  }
});

router.get("/cashbook", async (req, res) => {
  try {
    const entries = await BankTransaction.find({ companyId: req.user.companyId }).sort({ date: -1 }).lean();
    res.json({ entries });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load cash book");
  }
});

module.exports = router;
