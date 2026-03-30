const express = require("express");
const { z } = require("zod");
const TradeIn = require("../models/TradeIn");
const Customer = require("../models/Customer");
const { ensureObjectId, nextNumber, parseLimit, parsePage, handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { resolveWorkspaceId, withWorkspaceScope } = require("../services/scope");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("tradeins"));

const TradeInSchema = z.object({
  tradeInNo: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),

  deviceBrand: z.string().optional(),
  deviceModel: z.string().optional(),
  imei: z.string().optional(),
  serial: z.string().optional(),
  storage: z.string().optional(),
  condition: z.string().optional(),

  offeredAmount: z.number().nonnegative().optional(),
  agreedAmount: z.number().nonnegative().optional(),
  creditAmount: z.number().nonnegative().optional(),
  status: z.enum(["pending", "accepted", "rejected", "applied", "cancelled"]).optional(),
  notes: z.string().optional()
});

function buildTradeInFilter(query) {
  const { status, q } = query;
  const filter = { deletedAt: null };
  if (status) filter.status = status;
  if (String(query.unapplied || "") === "true") {
    filter.appliedSaleId = null;
    filter.appliedInvoiceId = null;
    if (!status) filter.status = "accepted";
  }
  const term = String(q || "").trim();
  if (term) {
    filter.$or = [
      { tradeInNo: { $regex: term, $options: "i" } },
      { customerName: { $regex: term, $options: "i" } },
      { customerPhone: { $regex: term, $options: "i" } },
      { imei: { $regex: term, $options: "i" } },
      { serial: { $regex: term, $options: "i" } },
      { deviceModel: { $regex: term, $options: "i" } }
    ];
  }
  return filter;
}

async function resolveCustomer(companyId, workspaceId, customerId) {
  if (!customerId) return null;
  ensureObjectId(customerId, "customer id");
  return Customer.findOne(withWorkspaceScope({ _id: customerId, companyId, deletedAt: null }, workspaceId)).lean();
}

router.get("/", async (req, res) => {
  try {
    const { limit, page } = req.query;
    const workspaceId = resolveWorkspaceId(req);
    const filter = withWorkspaceScope(
      { ...buildTradeInFilter(req.query), companyId: req.user.companyId },
      workspaceId
    );
    const safeLimit = parseLimit(limit, { defaultLimit: 200, maxLimit: 500 });
    const pageNum = parsePage(page);
    const total = await TradeIn.countDocuments(filter);
    const skip = (pageNum - 1) * safeLimit;
    const tradeIns = await TradeIn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: tradeIns.length, tradeIns });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list trade-ins");
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = TradeInSchema.parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const customer = await resolveCustomer(req.user.companyId, workspaceId, parsed.customerId);

    let tradeInNo = parsed.tradeInNo ? parsed.tradeInNo.trim() : "";
    if (tradeInNo) {
      const existing = await TradeIn.findOne({ companyId: req.user.companyId, tradeInNo }).lean();
      if (existing) return res.status(400).json({ error: "Trade-in number already exists" });
    } else {
      tradeInNo = await nextNumber("TI", TradeIn, "tradeInNo", "^TI-");
    }

    const tradeIn = await TradeIn.create({
      tradeInNo,
      companyId: req.user.companyId,
      workspaceId,
      userId: req.user._id,
      deviceId: String(req.headers["x-device-id"] || "server"),
      customerId: customer ? customer._id : parsed.customerId ? parsed.customerId : null,
      customerName: parsed.customerName?.trim() || customer?.name || undefined,
      customerPhone: parsed.customerPhone?.trim() || customer?.phone || undefined,
      deviceBrand: parsed.deviceBrand?.trim() || undefined,
      deviceModel: parsed.deviceModel?.trim() || undefined,
      imei: parsed.imei?.trim() || undefined,
      serial: parsed.serial?.trim() || undefined,
      storage: parsed.storage?.trim() || undefined,
      condition: parsed.condition?.trim() || undefined,
      offeredAmount: parsed.offeredAmount ?? 0,
      agreedAmount: parsed.agreedAmount ?? 0,
      creditAmount: parsed.creditAmount ?? parsed.agreedAmount ?? 0,
      status: parsed.status || "pending",
      notes: parsed.notes?.trim() || undefined
    });

    res.status(201).json({ tradeIn });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create trade-in");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "trade-in id");
    const workspaceId = resolveWorkspaceId(req);
    const tradeIn = await TradeIn.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    ).lean();
    if (!tradeIn) return res.status(404).json({ error: "Trade-in not found" });
    res.json({ tradeIn });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get trade-in");
  }
});

const updateTradeInHandler = async (req, res) => {
  try {
    ensureObjectId(req.params.id, "trade-in id");
    const parsed = TradeInSchema.partial().parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const tradeIn = await TradeIn.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!tradeIn) return res.status(404).json({ error: "Trade-in not found" });

    if (parsed.customerId !== undefined) {
      const customer = await resolveCustomer(req.user.companyId, workspaceId, parsed.customerId);
      tradeIn.customerId = customer ? customer._id : parsed.customerId ? parsed.customerId : null;
      if (customer && !parsed.customerName) tradeIn.customerName = customer.name;
      if (customer && !parsed.customerPhone) tradeIn.customerPhone = customer.phone;
    }
    if (parsed.customerName !== undefined) tradeIn.customerName = parsed.customerName?.trim() || undefined;
    if (parsed.customerPhone !== undefined) tradeIn.customerPhone = parsed.customerPhone?.trim() || undefined;
    if (parsed.deviceBrand !== undefined) tradeIn.deviceBrand = parsed.deviceBrand?.trim() || undefined;
    if (parsed.deviceModel !== undefined) tradeIn.deviceModel = parsed.deviceModel?.trim() || undefined;
    if (parsed.imei !== undefined) tradeIn.imei = parsed.imei?.trim() || undefined;
    if (parsed.serial !== undefined) tradeIn.serial = parsed.serial?.trim() || undefined;
    if (parsed.storage !== undefined) tradeIn.storage = parsed.storage?.trim() || undefined;
    if (parsed.condition !== undefined) tradeIn.condition = parsed.condition?.trim() || undefined;
    if (parsed.offeredAmount !== undefined) tradeIn.offeredAmount = parsed.offeredAmount;
    if (parsed.agreedAmount !== undefined) tradeIn.agreedAmount = parsed.agreedAmount;
    if (parsed.creditAmount !== undefined) tradeIn.creditAmount = parsed.creditAmount;
    if (parsed.status !== undefined) tradeIn.status = parsed.status;
    if (parsed.notes !== undefined) tradeIn.notes = parsed.notes?.trim() || undefined;

    tradeIn.workspaceId = tradeIn.workspaceId || workspaceId;
    tradeIn.userId = req.user._id;
    tradeIn.deviceId = String(req.headers["x-device-id"] || "server");
    tradeIn.version = (tradeIn.version || 1) + 1;
    await tradeIn.save();
    res.json({ tradeIn });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update trade-in");
  }
};

router.put("/:id", updateTradeInHandler);
router.patch("/:id", updateTradeInHandler);

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "trade-in id");
    const workspaceId = resolveWorkspaceId(req);
    const tradeIn = await TradeIn.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!tradeIn) return res.status(404).json({ error: "Trade-in not found" });
    tradeIn.deletedAt = new Date();
    tradeIn.version = (tradeIn.version || 1) + 1;
    tradeIn.userId = req.user._id;
    tradeIn.deviceId = String(req.headers["x-device-id"] || "server");
    await tradeIn.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete trade-in");
  }
});

module.exports = router;
