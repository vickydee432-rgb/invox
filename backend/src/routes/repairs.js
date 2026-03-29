const express = require("express");
const { z } = require("zod");
const RepairJob = require("../models/RepairJob");
const Customer = require("../models/Customer");
const { ensureObjectId, nextNumber, parseOptionalDate, parseLimit, parsePage, handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { resolveWorkspaceId, withWorkspaceScope } = require("../services/scope");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("repairs"));

const RepairCreateSchema = z.object({
  jobNo: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),

  deviceBrand: z.string().optional(),
  deviceModel: z.string().optional(),
  imei: z.string().optional(),
  serial: z.string().optional(),
  storage: z.string().optional(),
  color: z.string().optional(),
  condition: z.string().optional(),

  issueDescription: z.string().min(1),
  technicianId: z.string().optional(),

  status: z.enum(["pending", "assigned", "in_progress", "waiting_parts", "completed", "cancelled"]).optional(),
  laborCharge: z.number().nonnegative().optional(),
  partsCharge: z.number().nonnegative().optional(),
  amountPaid: z.number().nonnegative().optional(),
  receivedAt: z.string().optional(),
  notes: z.string().optional()
});

const RepairUpdateSchema = RepairCreateSchema.partial();

function buildRepairFilter(query) {
  const { status, technicianId, q } = query;
  const filter = { deletedAt: null };
  if (status) filter.status = status;
  if (technicianId) {
    ensureObjectId(String(technicianId), "technician id");
    filter.technicianId = technicianId;
  }
  const term = String(q || "").trim();
  if (term) {
    filter.$or = [
      { jobNo: { $regex: term, $options: "i" } },
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

function computeAmounts({ laborCharge, partsCharge, amountPaid }) {
  const labor = Math.max(0, Number(laborCharge || 0));
  const parts = Math.max(0, Number(partsCharge || 0));
  const totalCharge = labor + parts;
  const paid = Math.min(totalCharge, Math.max(0, Number(amountPaid || 0)));
  const balance = Math.max(0, totalCharge - paid);
  return { laborCharge: labor, partsCharge: parts, totalCharge, amountPaid: paid, balance };
}

router.get("/", async (req, res) => {
  try {
    const { limit, page } = req.query;
    const workspaceId = resolveWorkspaceId(req);
    const filter = withWorkspaceScope(
      { ...buildRepairFilter(req.query), companyId: req.user.companyId },
      workspaceId
    );
    const safeLimit = parseLimit(limit, { defaultLimit: 200, maxLimit: 500 });
    const pageNum = parsePage(page);
    const total = await RepairJob.countDocuments(filter);
    const skip = (pageNum - 1) * safeLimit;
    const jobs = await RepairJob.find(filter).sort({ receivedAt: -1 }).skip(skip).limit(safeLimit).lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: jobs.length, jobs });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list repairs");
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = RepairCreateSchema.parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const customer = await resolveCustomer(req.user.companyId, workspaceId, parsed.customerId);

    let jobNo = parsed.jobNo ? parsed.jobNo.trim() : "";
    if (jobNo) {
      const existing = await RepairJob.findOne({ companyId: req.user.companyId, jobNo }).lean();
      if (existing) return res.status(400).json({ error: "Job number already exists" });
    } else {
      jobNo = await nextNumber("JOB", RepairJob, "jobNo", "^JOB-");
    }

    const technicianId = parsed.technicianId ? String(parsed.technicianId).trim() : "";
    if (technicianId) ensureObjectId(technicianId, "technician id");

    const receivedAt = parseOptionalDate(parsed.receivedAt, "receivedAt") || new Date();
    const amounts = computeAmounts({
      laborCharge: parsed.laborCharge,
      partsCharge: parsed.partsCharge,
      amountPaid: parsed.amountPaid
    });

    const status =
      parsed.status ||
      (technicianId ? "assigned" : "pending");

    const job = await RepairJob.create({
      jobNo,
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
      color: parsed.color?.trim() || undefined,
      condition: parsed.condition?.trim() || undefined,

      issueDescription: parsed.issueDescription.trim(),
      technicianId: technicianId || null,
      status,

      ...amounts,

      receivedAt,
      completedAt: status === "completed" ? new Date() : undefined,
      notes: parsed.notes?.trim() || undefined
    });

    res.status(201).json({ job });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create repair job");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "repair job id");
    const workspaceId = resolveWorkspaceId(req);
    const job = await RepairJob.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    ).lean();
    if (!job) return res.status(404).json({ error: "Repair job not found" });
    res.json({ job });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get repair job");
  }
});

const updateRepairHandler = async (req, res) => {
  try {
    ensureObjectId(req.params.id, "repair job id");
    const parsed = RepairUpdateSchema.parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const job = await RepairJob.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!job) return res.status(404).json({ error: "Repair job not found" });

    if (parsed.customerId !== undefined) {
      const customer = await resolveCustomer(req.user.companyId, workspaceId, parsed.customerId);
      job.customerId = customer ? customer._id : parsed.customerId ? parsed.customerId : null;
      if (customer && !parsed.customerName) job.customerName = customer.name;
      if (customer && !parsed.customerPhone) job.customerPhone = customer.phone;
    }
    if (parsed.customerName !== undefined) job.customerName = parsed.customerName?.trim() || undefined;
    if (parsed.customerPhone !== undefined) job.customerPhone = parsed.customerPhone?.trim() || undefined;

    if (parsed.deviceBrand !== undefined) job.deviceBrand = parsed.deviceBrand?.trim() || undefined;
    if (parsed.deviceModel !== undefined) job.deviceModel = parsed.deviceModel?.trim() || undefined;
    if (parsed.imei !== undefined) job.imei = parsed.imei?.trim() || undefined;
    if (parsed.serial !== undefined) job.serial = parsed.serial?.trim() || undefined;
    if (parsed.storage !== undefined) job.storage = parsed.storage?.trim() || undefined;
    if (parsed.color !== undefined) job.color = parsed.color?.trim() || undefined;
    if (parsed.condition !== undefined) job.condition = parsed.condition?.trim() || undefined;

    if (parsed.issueDescription !== undefined) job.issueDescription = parsed.issueDescription.trim();

    if (parsed.technicianId !== undefined) {
      const tech = parsed.technicianId ? String(parsed.technicianId).trim() : "";
      if (tech) ensureObjectId(tech, "technician id");
      job.technicianId = tech || null;
    }

    const labor = parsed.laborCharge !== undefined ? parsed.laborCharge : job.laborCharge;
    const parts = parsed.partsCharge !== undefined ? parsed.partsCharge : job.partsCharge;
    const paid = parsed.amountPaid !== undefined ? parsed.amountPaid : job.amountPaid;
    const amounts = computeAmounts({ laborCharge: labor, partsCharge: parts, amountPaid: paid });
    job.laborCharge = amounts.laborCharge;
    job.partsCharge = amounts.partsCharge;
    job.totalCharge = amounts.totalCharge;
    job.amountPaid = amounts.amountPaid;
    job.balance = amounts.balance;

    if (parsed.receivedAt !== undefined) {
      job.receivedAt = parseOptionalDate(parsed.receivedAt, "receivedAt") || job.receivedAt;
    }
    if (parsed.notes !== undefined) job.notes = parsed.notes?.trim() || undefined;

    if (parsed.status !== undefined) {
      job.status = parsed.status;
      if (parsed.status === "completed" && !job.completedAt) job.completedAt = new Date();
      if (parsed.status !== "completed") job.completedAt = undefined;
    } else if (job.status === "pending" && job.technicianId) {
      job.status = "assigned";
    }

    job.workspaceId = job.workspaceId || workspaceId;
    job.userId = req.user._id;
    job.deviceId = String(req.headers["x-device-id"] || "server");
    job.version = (job.version || 1) + 1;
    await job.save();
    res.json({ job });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update repair job");
  }
};

router.put("/:id", updateRepairHandler);
router.patch("/:id", updateRepairHandler);

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "repair job id");
    const workspaceId = resolveWorkspaceId(req);
    const job = await RepairJob.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!job) return res.status(404).json({ error: "Repair job not found" });
    job.deletedAt = new Date();
    job.version = (job.version || 1) + 1;
    job.userId = req.user._id;
    job.deviceId = String(req.headers["x-device-id"] || "server");
    await job.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete repair job");
  }
});

module.exports = router;

