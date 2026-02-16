const express = require("express");
const { z } = require("zod");
const Company = require("../models/Company");
const { requireAuth } = require("../middleware/auth");
const { handleRouteError } = require("./_helpers");

const router = express.Router();
router.use(requireAuth);

const CompanyUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().optional(),
  logoUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().optional(),
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

router.get("/me", async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json({ company });
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
    if (parsed.taxId !== undefined) company.taxId = parsed.taxId;
    if (parsed.currency !== undefined) company.currency = parsed.currency;
    if (parsed.address !== undefined) company.address = parsed.address;
    if (parsed.payment !== undefined) company.payment = parsed.payment;

    await company.save();
    res.json({ company });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update company");
  }
});

module.exports = router;
