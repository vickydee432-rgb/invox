const express = require("express");
const { z } = require("zod");
const PhoneInventoryItem = require("../models/PhoneInventoryItem");
const { ensureObjectId, parseOptionalDate, parseLimit, parsePage, handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { resolveWorkspaceId, withWorkspaceScope } = require("../services/scope");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("inventory"));

const PhoneSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  storage: z.string().optional(),
  color: z.string().optional(),
  condition: z.string().optional(),
  imei: z.string().optional(),
  serial: z.string().optional(),
  costPrice: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
  status: z.enum(["in_stock", "reserved", "sold", "in_repair", "returned"]).optional(),
  branchId: z.string().optional(),
  receivedAt: z.string().optional(),
  notes: z.string().optional()
});

function buildPhoneFilter(query) {
  const filter = { deletedAt: null };
  if (query.status) filter.status = String(query.status);
  const term = String(query.q || "").trim();
  if (term) {
    filter.$or = [
      { brand: { $regex: term, $options: "i" } },
      { model: { $regex: term, $options: "i" } },
      { imei: { $regex: term, $options: "i" } },
      { serial: { $regex: term, $options: "i" } }
    ];
  }
  return filter;
}

router.get("/lookup", async (req, res) => {
  try {
    const imei = String(req.query.imei || "").trim();
    const serial = String(req.query.serial || "").trim();
    if (!imei && !serial) return res.status(400).json({ error: "imei or serial is required" });
    const workspaceId = resolveWorkspaceId(req);
    const filter = withWorkspaceScope({ companyId: req.user.companyId, deletedAt: null }, workspaceId);
    if (imei) filter.imei = imei;
    else filter.serial = serial;
    const item = await PhoneInventoryItem.findOne(filter).lean();
    if (!item) return res.status(404).json({ error: "Phone inventory item not found" });
    res.json({ item });
  } catch (err) {
    return handleRouteError(res, err, "Failed to lookup phone inventory item");
  }
});

router.get("/", async (req, res) => {
  try {
    const { limit, page } = req.query;
    const workspaceId = resolveWorkspaceId(req);
    const filter = withWorkspaceScope(
      { ...buildPhoneFilter(req.query), companyId: req.user.companyId },
      workspaceId
    );
    const safeLimit = parseLimit(limit, { defaultLimit: 200, maxLimit: 500 });
    const pageNum = parsePage(page);
    const total = await PhoneInventoryItem.countDocuments(filter);
    const skip = (pageNum - 1) * safeLimit;
    const items = await PhoneInventoryItem.find(filter).sort({ receivedAt: -1 }).skip(skip).limit(safeLimit).lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: items.length, items });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list phone inventory");
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = PhoneSchema.parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    if (parsed.branchId) ensureObjectId(parsed.branchId, "branch id");
    const receivedAt = parseOptionalDate(parsed.receivedAt, "receivedAt") || new Date();
    const item = await PhoneInventoryItem.create({
      companyId: req.user.companyId,
      workspaceId,
      userId: req.user._id,
      deviceId: String(req.headers["x-device-id"] || "server"),
      brand: parsed.brand.trim(),
      model: parsed.model.trim(),
      storage: parsed.storage?.trim() || undefined,
      color: parsed.color?.trim() || undefined,
      condition: parsed.condition?.trim() || undefined,
      imei: parsed.imei?.trim() || undefined,
      serial: parsed.serial?.trim() || undefined,
      costPrice: parsed.costPrice ?? 0,
      salePrice: parsed.salePrice ?? 0,
      status: parsed.status || "in_stock",
      branchId: parsed.branchId || null,
      receivedAt,
      notes: parsed.notes?.trim() || undefined
    });
    res.status(201).json({ item });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.imei) {
      return res.status(409).json({ error: "IMEI already exists" });
    }
    if (err?.code === 11000 && err?.keyPattern?.serial) {
      return res.status(409).json({ error: "Serial already exists" });
    }
    return handleRouteError(res, err, "Failed to create phone inventory item");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "phone inventory id");
    const workspaceId = resolveWorkspaceId(req);
    const item = await PhoneInventoryItem.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    ).lean();
    if (!item) return res.status(404).json({ error: "Phone inventory item not found" });
    res.json({ item });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get phone inventory item");
  }
});

const updatePhoneHandler = async (req, res) => {
  try {
    ensureObjectId(req.params.id, "phone inventory id");
    const parsed = PhoneSchema.partial().parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const item = await PhoneInventoryItem.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!item) return res.status(404).json({ error: "Phone inventory item not found" });

    if (parsed.brand !== undefined) item.brand = parsed.brand.trim();
    if (parsed.model !== undefined) item.model = parsed.model.trim();
    if (parsed.storage !== undefined) item.storage = parsed.storage?.trim() || undefined;
    if (parsed.color !== undefined) item.color = parsed.color?.trim() || undefined;
    if (parsed.condition !== undefined) item.condition = parsed.condition?.trim() || undefined;
    if (parsed.imei !== undefined) item.imei = parsed.imei?.trim() || undefined;
    if (parsed.serial !== undefined) item.serial = parsed.serial?.trim() || undefined;
    if (parsed.costPrice !== undefined) item.costPrice = parsed.costPrice;
    if (parsed.salePrice !== undefined) item.salePrice = parsed.salePrice;
    if (parsed.status !== undefined) item.status = parsed.status;
    if (parsed.branchId !== undefined) {
      if (parsed.branchId) ensureObjectId(parsed.branchId, "branch id");
      item.branchId = parsed.branchId || null;
    }
    if (parsed.receivedAt !== undefined) item.receivedAt = parseOptionalDate(parsed.receivedAt, "receivedAt") || item.receivedAt;
    if (parsed.notes !== undefined) item.notes = parsed.notes?.trim() || undefined;

    item.workspaceId = item.workspaceId || workspaceId;
    item.userId = req.user._id;
    item.deviceId = String(req.headers["x-device-id"] || "server");
    item.version = (item.version || 1) + 1;
    await item.save();
    res.json({ item });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.imei) {
      return res.status(409).json({ error: "IMEI already exists" });
    }
    if (err?.code === 11000 && err?.keyPattern?.serial) {
      return res.status(409).json({ error: "Serial already exists" });
    }
    return handleRouteError(res, err, "Failed to update phone inventory item");
  }
};

router.put("/:id", updatePhoneHandler);
router.patch("/:id", updatePhoneHandler);

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "phone inventory id");
    const workspaceId = resolveWorkspaceId(req);
    const item = await PhoneInventoryItem.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!item) return res.status(404).json({ error: "Phone inventory item not found" });
    item.deletedAt = new Date();
    item.version = (item.version || 1) + 1;
    item.userId = req.user._id;
    item.deviceId = String(req.headers["x-device-id"] || "server");
    await item.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete phone inventory item");
  }
});

module.exports = router;
