const express = require("express");
const { z } = require("zod");
const Project = require("../models/Project");
const Invoice = require("../models/Invoice");
const Expense = require("../models/Expense");
const { ensureObjectId, handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { buildProjectExpensesWorkbook } = require("../services/export");

const router = express.Router();
router.use(requireAuth, requireSubscription);

const ProjectCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

const ProjectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});

router.post("/", async (req, res) => {
  try {
    const parsed = ProjectCreateSchema.parse(req.body);
    const project = await Project.create({
      name: parsed.name.trim(),
      description: parsed.description,
      companyId: req.user.companyId
    });
    res.status(201).json({ project });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Project name already exists" });
    return handleRouteError(res, err, "Failed to create project");
  }
});

router.put("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "project id");
    const parsed = ProjectUpdateSchema.parse(req.body);
    const project = await Project.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (parsed.name !== undefined) project.name = parsed.name.trim();
    if (parsed.description !== undefined) project.description = parsed.description;
    if (parsed.isActive !== undefined) project.isActive = parsed.isActive;

    await project.save();
    res.json({ project });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Project name already exists" });
    return handleRouteError(res, err, "Failed to update project");
  }
});

router.get("/", async (req, res) => {
  try {
    const projects = await Project.find({ companyId: req.user.companyId }).sort({ name: 1 }).lean();
    res.json({ count: projects.length, projects });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list projects");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "project id");
    const project = await Project.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const update = { projectId: null, projectLabel: null };
    await Promise.all([
      Expense.updateMany({ projectId: project._id, companyId: req.user.companyId }, update),
      Invoice.updateMany({ projectId: project._id, companyId: req.user.companyId }, update),
      require("../models/Quote").updateMany({ projectId: project._id, companyId: req.user.companyId }, update)
    ]);

    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete project");
  }
});

// Profitability summary: income = paid invoices total, billed = invoices total, expenses = expenses total
router.get("/:id/summary", async (req, res) => {
  try {
    const projectId = req.params.id;
    ensureObjectId(projectId, "project id");
    const mongoose = require("mongoose");
    const projectObjectId = mongoose.Types.ObjectId.createFromHexString(projectId);

    const [billedAgg, paidAgg, expAgg] = await Promise.all([
      Invoice.aggregate([
        { $match: { projectId: projectObjectId, companyId: req.user.companyId } },
        { $group: { _id: null, billed: { $sum: "$total" } } }
      ]),
      Invoice.aggregate([
        { $match: { projectId: projectObjectId, companyId: req.user.companyId } },
        { $group: { _id: null, paid: { $sum: "$amountPaid" } } }
      ]),
      Expense.aggregate([
        { $match: { projectId: projectObjectId, companyId: req.user.companyId } },
        { $group: { _id: null, expenses: { $sum: "$amount" } } }
      ])
    ]);

    const billed = billedAgg[0]?.billed || 0;
    const paid = paidAgg[0]?.paid || 0;
    const expenses = expAgg[0]?.expenses || 0;

    res.json({
      projectId,
      billed,
      paid,
      expenses,
      profit_on_paid: paid - expenses,
      profit_on_billed: billed - expenses
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to build project summary");
  }
});

router.get("/:id/expenses/export.xlsx", async (req, res) => {
  try {
    const projectId = req.params.id;
    ensureObjectId(projectId, "project id");
    const project = await Project.findOne({ _id: projectId, companyId: req.user.companyId }).lean();
    if (!project) return res.status(404).json({ error: "Project not found" });

    const expenses = await Expense.find({ projectId, companyId: req.user.companyId })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const openingBalanceRaw = req.query.openingBalance;
    const openingBalance =
      openingBalanceRaw !== undefined && openingBalanceRaw !== ""
        ? Number(openingBalanceRaw)
        : Number.NaN;

    const workbook = buildProjectExpensesWorkbook(expenses, openingBalance);
    const safeName = project.name.replace(/[^a-z0-9_-]+/gi, "_");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="project-${safeName}-expenses.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export project expenses");
  }
});

module.exports = router;
