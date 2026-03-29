const express = require("express");
const { z } = require("zod");
const InstallmentPlan = require("../models/InstallmentPlan");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const Invoice = require("../models/Invoice");
const {
  ensureObjectId,
  nextNumber,
  parseOptionalDate,
  parseLimit,
  parsePage,
  handleRouteError
} = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { resolveWorkspaceId, withWorkspaceScope } = require("../services/scope");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("installments"));

const PlanCreateSchema = z.object({
  planNo: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),

  referenceType: z.enum(["sale", "invoice", "other"]).optional(),
  saleId: z.string().optional(),
  invoiceId: z.string().optional(),
  referenceNo: z.string().optional(),

  totalAmount: z.number().nonnegative(),
  downPayment: z.number().nonnegative().optional(),
  installmentCount: z.number().int().min(1).optional(),
  frequency: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  startDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  notes: z.string().optional()
});

const PlanUpdateSchema = PlanCreateSchema.partial();

const AddPaymentSchema = z.object({
  date: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional()
});

function buildPlanFilter(query) {
  const filter = { deletedAt: null };
  if (query.status) filter.status = String(query.status);
  if (query.customerId) {
    ensureObjectId(String(query.customerId), "customer id");
    filter.customerId = query.customerId;
  }
  const term = String(query.q || "").trim();
  if (term) {
    filter.$or = [
      { planNo: { $regex: term, $options: "i" } },
      { customerName: { $regex: term, $options: "i" } },
      { customerPhone: { $regex: term, $options: "i" } },
      { referenceNo: { $regex: term, $options: "i" } }
    ];
  }
  return filter;
}

async function resolveCustomer(companyId, workspaceId, customerId) {
  if (!customerId) return null;
  ensureObjectId(customerId, "customer id");
  return Customer.findOne(withWorkspaceScope({ _id: customerId, companyId, deletedAt: null }, workspaceId)).lean();
}

async function resolveReference(companyId, workspaceId, { referenceType, saleId, invoiceId }) {
  if (referenceType === "sale" && saleId) {
    ensureObjectId(saleId, "sale id");
    return Sale.findOne(withWorkspaceScope({ _id: saleId, companyId, deletedAt: null }, workspaceId)).lean();
  }
  if (referenceType === "invoice" && invoiceId) {
    ensureObjectId(invoiceId, "invoice id");
    return Invoice.findOne(withWorkspaceScope({ _id: invoiceId, companyId, deletedAt: null }, workspaceId)).lean();
  }
  return null;
}

function computePlanAmounts({ totalAmount, downPayment, amountPaid }) {
  const total = Math.max(0, Number(totalAmount || 0));
  const down = Math.min(total, Math.max(0, Number(downPayment || 0)));
  const paid = Math.min(total, Math.max(down, Number(amountPaid || down)));
  const balance = Math.max(0, total - paid);
  return { totalAmount: total, downPayment: down, amountPaid: paid, balance };
}

router.get("/", async (req, res) => {
  try {
    const { limit, page } = req.query;
    const workspaceId = resolveWorkspaceId(req);
    const filter = withWorkspaceScope(
      { ...buildPlanFilter(req.query), companyId: req.user.companyId },
      workspaceId
    );
    const safeLimit = parseLimit(limit, { defaultLimit: 200, maxLimit: 500 });
    const pageNum = parsePage(page);
    const total = await InstallmentPlan.countDocuments(filter);
    const skip = (pageNum - 1) * safeLimit;
    const plans = await InstallmentPlan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: plans.length, plans });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list installment plans");
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = PlanCreateSchema.parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const customer = await resolveCustomer(req.user.companyId, workspaceId, parsed.customerId);

    let planNo = parsed.planNo ? parsed.planNo.trim() : "";
    if (planNo) {
      const existing = await InstallmentPlan.findOne({ companyId: req.user.companyId, planNo }).lean();
      if (existing) return res.status(400).json({ error: "Plan number already exists" });
    } else {
      planNo = await nextNumber("HP", InstallmentPlan, "planNo", "^HP-");
    }

    const referenceType = parsed.referenceType || "sale";
    const reference = await resolveReference(req.user.companyId, workspaceId, {
      referenceType,
      saleId: parsed.saleId,
      invoiceId: parsed.invoiceId
    });

    const amounts = computePlanAmounts({
      totalAmount: parsed.totalAmount,
      downPayment: parsed.downPayment,
      amountPaid: parsed.downPayment ?? 0
    });

    const startDate = parseOptionalDate(parsed.startDate, "startDate") || new Date();
    const nextDueDate = parseOptionalDate(parsed.nextDueDate, "nextDueDate") || undefined;
    const status = amounts.balance <= 0 ? "completed" : "active";

    const plan = await InstallmentPlan.create({
      planNo,
      companyId: req.user.companyId,
      workspaceId,
      userId: req.user._id,
      deviceId: String(req.headers["x-device-id"] || "server"),

      customerId: customer ? customer._id : parsed.customerId ? parsed.customerId : null,
      customerName: parsed.customerName?.trim() || customer?.name || reference?.customerName || undefined,
      customerPhone: parsed.customerPhone?.trim() || customer?.phone || reference?.customerPhone || undefined,

      referenceType,
      saleId: referenceType === "sale" ? parsed.saleId || null : null,
      invoiceId: referenceType === "invoice" ? parsed.invoiceId || null : null,
      referenceNo: parsed.referenceNo?.trim() || reference?.saleNo || reference?.invoiceNo || undefined,

      ...amounts,
      installmentCount: parsed.installmentCount ?? 1,
      frequency: parsed.frequency || "monthly",
      startDate,
      nextDueDate,
      status,
      payments: amounts.downPayment > 0 ? [{ date: startDate, amount: amounts.downPayment, note: "Down payment", createdByUserId: req.user._id }] : [],
      notes: parsed.notes?.trim() || undefined
    });

    res.status(201).json({ plan });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create installment plan");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "plan id");
    const workspaceId = resolveWorkspaceId(req);
    const plan = await InstallmentPlan.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    ).lean();
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json({ plan });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get plan");
  }
});

router.post("/:id/payments", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "plan id");
    const parsed = AddPaymentSchema.parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const plan = await InstallmentPlan.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const payDate = parseOptionalDate(parsed.date, "date");
    const amount = Number(parsed.amount || 0);
    if (!payDate || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid payment" });
    }

    const nextPaid = Math.min(plan.totalAmount, (plan.amountPaid || 0) + amount);
    const nextBalance = Math.max(0, plan.totalAmount - nextPaid);
    plan.payments.push({
      date: payDate,
      amount,
      method: parsed.method?.trim() || undefined,
      reference: parsed.reference?.trim() || undefined,
      note: parsed.note?.trim() || undefined,
      createdByUserId: req.user._id
    });
    plan.amountPaid = nextPaid;
    plan.balance = nextBalance;
    if (nextBalance <= 0) plan.status = "completed";
    plan.version = (plan.version || 1) + 1;
    plan.userId = req.user._id;
    plan.deviceId = String(req.headers["x-device-id"] || "server");
    await plan.save();

    res.json({ plan });
  } catch (err) {
    return handleRouteError(res, err, "Failed to add payment");
  }
});

const updatePlanHandler = async (req, res) => {
  try {
    ensureObjectId(req.params.id, "plan id");
    const parsed = PlanUpdateSchema.parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const plan = await InstallmentPlan.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    if (parsed.customerId !== undefined) {
      const customer = await resolveCustomer(req.user.companyId, workspaceId, parsed.customerId);
      plan.customerId = customer ? customer._id : parsed.customerId ? parsed.customerId : null;
      if (customer && !parsed.customerName) plan.customerName = customer.name;
      if (customer && !parsed.customerPhone) plan.customerPhone = customer.phone;
    }
    if (parsed.customerName !== undefined) plan.customerName = parsed.customerName?.trim() || undefined;
    if (parsed.customerPhone !== undefined) plan.customerPhone = parsed.customerPhone?.trim() || undefined;
    if (parsed.referenceType !== undefined) plan.referenceType = parsed.referenceType;
    if (parsed.saleId !== undefined) {
      const id = parsed.saleId ? String(parsed.saleId).trim() : "";
      if (id) ensureObjectId(id, "sale id");
      plan.saleId = id || null;
    }
    if (parsed.invoiceId !== undefined) {
      const id = parsed.invoiceId ? String(parsed.invoiceId).trim() : "";
      if (id) ensureObjectId(id, "invoice id");
      plan.invoiceId = id || null;
    }
    if (parsed.referenceNo !== undefined) plan.referenceNo = parsed.referenceNo?.trim() || undefined;
    if (parsed.installmentCount !== undefined) plan.installmentCount = parsed.installmentCount;
    if (parsed.frequency !== undefined) plan.frequency = parsed.frequency;
    if (parsed.startDate !== undefined) plan.startDate = parseOptionalDate(parsed.startDate, "startDate") || plan.startDate;
    if (parsed.nextDueDate !== undefined) plan.nextDueDate = parseOptionalDate(parsed.nextDueDate, "nextDueDate") || undefined;
    if (parsed.notes !== undefined) plan.notes = parsed.notes?.trim() || undefined;
    if (parsed.status !== undefined) plan.status = parsed.status;

    if (parsed.totalAmount !== undefined || parsed.downPayment !== undefined) {
      const total = parsed.totalAmount !== undefined ? parsed.totalAmount : plan.totalAmount;
      const down = parsed.downPayment !== undefined ? parsed.downPayment : plan.downPayment;
      const amounts = computePlanAmounts({ totalAmount: total, downPayment: down, amountPaid: plan.amountPaid });
      plan.totalAmount = amounts.totalAmount;
      plan.downPayment = amounts.downPayment;
      plan.amountPaid = amounts.amountPaid;
      plan.balance = amounts.balance;
      if (amounts.balance <= 0) plan.status = "completed";
    }

    plan.version = (plan.version || 1) + 1;
    plan.userId = req.user._id;
    plan.deviceId = String(req.headers["x-device-id"] || "server");
    await plan.save();
    res.json({ plan });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update plan");
  }
};

router.put("/:id", updatePlanHandler);
router.patch("/:id", updatePlanHandler);

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "plan id");
    const workspaceId = resolveWorkspaceId(req);
    const plan = await InstallmentPlan.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    plan.deletedAt = new Date();
    plan.status = "cancelled";
    plan.version = (plan.version || 1) + 1;
    plan.userId = req.user._id;
    plan.deviceId = String(req.headers["x-device-id"] || "server");
    await plan.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete plan");
  }
});

module.exports = router;

