const express = require("express");
const { z } = require("zod");
const Company = require("../models/Company");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { handleRouteError } = require("./_helpers");
const { applyWorkspace } = require("../services/workspace");
const { setCompanySensitive, sanitizeCompany } = require("../services/companySensitive");

const router = express.Router();
router.use(requireAuth, requireSubscription);

const CompanyUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().optional(),
  logoUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().optional(),
  dataRegion: z.string().optional(),
  dataRetentionDays: z.number().int().min(30).max(3650).optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    })
    .optional(),
  payment: z
    .object({
      bankName: z.string().optional(),
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      routingNumber: z.string().optional(),
      swift: z.string().optional(),
      mobileMoney: z.string().optional(),
      paymentInstructions: z.string().optional()
    })
    .optional()
});

const WorkspaceUpdateSchema = z.object({
  businessType: z.enum(["retail", "construction", "agency", "services", "freelance"]),
  enabledModules: z.array(z.string()).optional(),
  labels: z.record(z.string()).optional(),
  taxEnabled: z.boolean().optional(),
  inventoryEnabled: z.boolean().optional(),
  projectTrackingEnabled: z.boolean().optional()
});

router.get("/me", async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });
    const revealSensitive = ["owner", "admin"].includes(req.user.role);
    res.json({ company: sanitizeCompany(company, { revealSensitive }) });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load company");
  }
});

router.put("/me", async (req, res) => {
  try {
    const parsed = CompanyUpdateSchema.parse(req.body);
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    if (parsed.name !== undefined) company.name = parsed.name.trim();
    if (parsed.legalName !== undefined) company.legalName = parsed.legalName;
    if (parsed.logoUrl !== undefined) company.logoUrl = parsed.logoUrl;
    if (parsed.email !== undefined) company.email = parsed.email.toLowerCase();
    if (parsed.phone !== undefined) company.phone = parsed.phone;
    if (parsed.website !== undefined) company.website = parsed.website;
    if (parsed.taxId !== undefined || parsed.payment !== undefined) {
      setCompanySensitive(company, { taxId: parsed.taxId, payment: parsed.payment });
    }
    if (parsed.currency !== undefined) company.currency = parsed.currency;
    if (parsed.address !== undefined) company.address = parsed.address;
    if (parsed.dataRegion !== undefined) company.dataRegion = parsed.dataRegion;
    if (parsed.dataRetentionDays !== undefined) company.dataRetentionDays = parsed.dataRetentionDays;

    await company.save();
    const revealSensitive = ["owner", "admin"].includes(req.user.role);
    res.json({ company: sanitizeCompany(company.toObject(), { revealSensitive }) });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update company");
  }
});

router.get("/workspace", async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json({
      businessType: company.businessType,
      enabledModules: company.enabledModules || [],
      labels: company.labels || {},
      taxEnabled: company.taxEnabled ?? true,
      inventoryEnabled: company.inventoryEnabled ?? false,
      projectTrackingEnabled: company.projectTrackingEnabled ?? true,
      workspaceConfigured: company.workspaceConfigured ?? false
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load workspace settings");
  }
});

router.put("/workspace", async (req, res) => {
  try {
    const parsed = WorkspaceUpdateSchema.parse(req.body);
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    applyWorkspace(company, parsed.businessType, parsed);
    await company.save();
    res.json({ company });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update workspace settings");
  }
});

module.exports = router;
