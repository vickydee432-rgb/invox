const express = require("express");
const { z } = require("zod");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Company = require("../models/Company");
const { applyWorkspace } = require("../services/workspace");
const { setCompanySensitive } = require("../services/companySensitive");
const { handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  company: z.object({
    name: z.string().min(2),
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
      .optional(),
    businessType: z.enum(["retail", "construction", "agency", "services", "freelance"])
  })
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

const PasswordResetRequestSchema = z.object({
  email: z.string().email()
});

const PasswordResetSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  newPassword: z.string().min(8)
});

function signToken(user) {
  const secret = process.env.AUTH_JWT_SECRET;
  const ttl = process.env.AUTH_TOKEN_TTL || "7d";
  return jwt.sign({ sub: user._id.toString(), email: user.email }, secret, { expiresIn: ttl });
}

router.post("/register", async (req, res) => {
  try {
    const parsed = RegisterSchema.parse(req.body);
    const existing = await User.findOne({ email: parsed.email.toLowerCase() }).lean();
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const company = new Company({
      name: parsed.company.name.trim(),
      legalName: parsed.company.legalName,
      logoUrl: parsed.company.logoUrl,
      email: parsed.company.email?.toLowerCase(),
      phone: parsed.company.phone,
      website: parsed.company.website,
      currency: parsed.company.currency || "USD",
      address: parsed.company.address || {},
      subscriptionStatus: "pending",
      subscriptionPlan: null,
      subscriptionCycle: null,
      currentPeriodEnd: null,
      trialEndsAt: null
    });
    setCompanySensitive(company, { taxId: parsed.company.taxId, payment: parsed.company.payment });
    applyWorkspace(company, parsed.company.businessType);
    await company.save();

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const user = await User.create({
      name: parsed.name.trim(),
      email: parsed.email.toLowerCase(),
      passwordHash,
      companyId: company._id,
      role: "owner"
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, companyId: user.companyId, role: user.role }
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to register");
  }
});

router.post("/login", async (req, res) => {
  try {
    const parsed = LoginSchema.parse(req.body);
    const user = await User.findOne({ email: parsed.email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user);
    res.json({ token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    return handleRouteError(res, err, "Failed to login");
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.put("/password", requireAuth, async (req, res) => {
  try {
    const parsed = PasswordChangeSchema.parse(req.body);
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update password");
  }
});

router.post("/forgot", async (req, res) => {
  try {
    const parsed = PasswordResetRequestSchema.parse(req.body);
    const user = await User.findOne({ email: parsed.email.toLowerCase() });
    if (!user) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetTokenHash = tokenHash;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    res.json({ ok: true, resetToken: token });
  } catch (err) {
    return handleRouteError(res, err, "Failed to request password reset");
  }
});

router.post("/reset", async (req, res) => {
  try {
    const parsed = PasswordResetSchema.parse(req.body);
    const tokenHash = crypto.createHash("sha256").update(parsed.token).digest("hex");
    const user = await User.findOne({
      email: parsed.email.toLowerCase(),
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });

    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to reset password");
  }
});

module.exports = router;
