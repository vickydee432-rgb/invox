const express = require("express");
const { z } = require("zod");
const Branch = require("../models/Branch");
const { ensureObjectId, handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");

const router = express.Router();
router.use(requireAuth, requireSubscription);

const BranchSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
});

router.get("/", async (req, res) => {
  try {
    const branches = await Branch.find({ companyId: req.user.companyId }).sort({ createdAt: -1 }).lean();
    res.json({ branches });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list branches");
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = BranchSchema.parse(req.body);
    if (parsed.isDefault) {
      await Branch.updateMany({ companyId: req.user.companyId }, { $set: { isDefault: false } });
    }
    const branch = await Branch.create({
      companyId: req.user.companyId,
      name: parsed.name,
      code: parsed.code,
      address: parsed.address,
      isDefault: parsed.isDefault ?? false,
      isActive: parsed.isActive ?? true
    });
    res.status(201).json({ branch });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create branch");
  }
});

router.put("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "branch id");
    const parsed = BranchSchema.parse(req.body);
    const branch = await Branch.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    if (parsed.isDefault) {
      await Branch.updateMany({ companyId: req.user.companyId }, { $set: { isDefault: false } });
    }
    branch.name = parsed.name ?? branch.name;
    branch.code = parsed.code ?? branch.code;
    branch.address = parsed.address ?? branch.address;
    if (parsed.isDefault !== undefined) branch.isDefault = parsed.isDefault;
    if (parsed.isActive !== undefined) branch.isActive = parsed.isActive;
    await branch.save();
    res.json({ branch });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update branch");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "branch id");
    const branch = await Branch.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    branch.isActive = false;
    branch.isDefault = false;
    await branch.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete branch");
  }
});

module.exports = router;
