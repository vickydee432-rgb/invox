const express = require("express");
const { z } = require("zod");
const Customer = require("../models/Customer");
const Invoice = require("../models/Invoice");
const Sale = require("../models/Sale");
const RepairJob = require("../models/RepairJob");
const TradeIn = require("../models/TradeIn");
const InstallmentPlan = require("../models/InstallmentPlan");
const { ensureObjectId, parseLimit, parsePage, handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { resolveWorkspaceId, withWorkspaceScope } = require("../services/scope");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("customers"));

const CustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

function buildCustomerFilter(query) {
  const term = String(query.q || query.search || "").trim();
  const filter = { deletedAt: null };
  if (term) {
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } }
    ];
  }
  if (query.active === "false") {
    filter.isActive = false;
  } else if (query.active === "true") {
    filter.isActive = { $ne: false };
  }
  return filter;
}

router.get("/", async (req, res) => {
  try {
    const { limit, page } = req.query;
    const workspaceId = resolveWorkspaceId(req);
    const filter = withWorkspaceScope(
      { ...buildCustomerFilter(req.query), companyId: req.user.companyId },
      workspaceId
    );
    const safeLimit = parseLimit(limit, { defaultLimit: 200, maxLimit: 500 });
    const pageNum = parsePage(page);
    const total = await Customer.countDocuments(filter);
    const skip = (pageNum - 1) * safeLimit;
    const customers = await Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: customers.length, customers });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list customers");
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = CustomerSchema.parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const customer = await Customer.create({
      companyId: req.user.companyId,
      workspaceId,
      name: parsed.name.trim(),
      phone: parsed.phone?.trim() || undefined,
      email: parsed.email?.trim() || undefined,
      address: parsed.address?.trim() || undefined,
      notes: parsed.notes?.trim() || undefined,
      tags: parsed.tags || [],
      isActive: parsed.isActive ?? true
    });
    res.status(201).json({ customer });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create customer");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "customer id");
    const workspaceId = resolveWorkspaceId(req);
    const customer = await Customer.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    ).lean();
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json({ customer });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get customer");
  }
});

router.get("/:id/history", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "customer id");
    const workspaceId = resolveWorkspaceId(req);
    const customer = await Customer.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    ).lean();
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const orMatch = [{ customerId: customer._id }];
    if (customer.name) orMatch.push({ customerName: customer.name });
    if (customer.phone) orMatch.push({ customerPhone: customer.phone });

    const base = { companyId: req.user.companyId, deletedAt: null, $or: orMatch };
    const scoped = (filter) => withWorkspaceScope(filter, workspaceId);

    const [invoices, sales, repairs, tradeIns, installments] = await Promise.all([
      Invoice.find(scoped(base)).sort({ issueDate: -1 }).limit(10).lean(),
      Sale.find(scoped(base)).sort({ issueDate: -1 }).limit(10).lean(),
      RepairJob.find(scoped(base)).sort({ receivedAt: -1 }).limit(10).lean(),
      TradeIn.find(scoped(base)).sort({ createdAt: -1 }).limit(10).lean(),
      InstallmentPlan.find(scoped(base)).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    res.json({
      customer,
      history: {
        invoices,
        sales,
        repairs,
        tradeIns,
        installments
      }
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load customer history");
  }
});

const updateCustomerHandler = async (req, res) => {
  try {
    ensureObjectId(req.params.id, "customer id");
    const parsed = CustomerSchema.partial().parse(req.body || {});
    const workspaceId = resolveWorkspaceId(req);
    const customer = await Customer.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (parsed.name !== undefined) customer.name = parsed.name.trim();
    if (parsed.phone !== undefined) customer.phone = parsed.phone?.trim() || undefined;
    if (parsed.email !== undefined) customer.email = parsed.email?.trim() || undefined;
    if (parsed.address !== undefined) customer.address = parsed.address?.trim() || undefined;
    if (parsed.notes !== undefined) customer.notes = parsed.notes?.trim() || undefined;
    if (parsed.tags !== undefined) customer.tags = parsed.tags || [];
    if (parsed.isActive !== undefined) customer.isActive = parsed.isActive;
    customer.version = (customer.version || 1) + 1;
    await customer.save();
    res.json({ customer });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update customer");
  }
};

router.put("/:id", updateCustomerHandler);
router.patch("/:id", updateCustomerHandler);

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "customer id");
    const workspaceId = resolveWorkspaceId(req);
    const customer = await Customer.findOne(
      withWorkspaceScope({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }, workspaceId)
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    customer.deletedAt = new Date();
    customer.isActive = false;
    customer.version = (customer.version || 1) + 1;
    await customer.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete customer");
  }
});

module.exports = router;

