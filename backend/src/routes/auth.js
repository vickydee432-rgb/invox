const express = require("express");
const { z } = require("zod");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const User = require("../models/User");
const Company = require("../models/Company");
const { applyWorkspace } = require("../services/workspace");
const { setCompanySensitive } = require("../services/companySensitive");
const { handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { authLimiter, authSlowDown } = require("../middleware/rateLimit");

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
  password: z.string().min(1),
  mfaCode: z.string().optional(),
  backupCode: z.string().optional()
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

const MfaVerifySchema = z.object({
  token: z.string().min(4)
});

const MfaDisableSchema = z.object({
  password: z.string().min(1),
  token: z.string().optional(),
  backupCode: z.string().optional()
});

function signToken(user) {
  const secret = process.env.AUTH_JWT_SECRET;
  const ttl = process.env.AUTH_TOKEN_TTL || "7d";
  return jwt.sign({ sub: user._id.toString(), email: user.email }, secret, { expiresIn: ttl });
}

function isLocked(user) {
  return user?.lockUntil && user.lockUntil.getTime() > Date.now();
}

function remainingLockSeconds(user) {
  if (!user?.lockUntil) return 0;
  return Math.max(0, Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000));
}

function hashBackupCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateBackupCodes() {
  const codes = Array.from({ length: 10 }).map(() => crypto.randomBytes(5).toString("hex"));
  const hashes = codes.map((code) => hashBackupCode(code));
  return { codes, hashes };
}

function verifyMfaToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(token),
    window: 1
  });
}

router.post("/register", authLimiter, authSlowDown, async (req, res) => {
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
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
        mfaEnabled: user.mfaEnabled
      }
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to register");
  }
});

router.post("/login", authLimiter, authSlowDown, async (req, res) => {
  try {
    const parsed = LoginSchema.parse(req.body);
    const user = await User.findOne({ email: parsed.email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (isLocked(user)) {
      return res.status(429).json({
        error: "Account temporarily locked. Try again later.",
        lockSeconds: remainingLockSeconds(user)
      });
    }

    const ok = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      const maxAttempts = Number(process.env.AUTH_MAX_LOGIN_ATTEMPTS || 5);
      if (user.failedLoginAttempts >= maxAttempts) {
        const lockMs = Number(process.env.AUTH_LOCK_TIME_MS || 15 * 60 * 1000);
        user.lockUntil = new Date(Date.now() + lockMs);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.mfaEnabled) {
      const mfaCode = parsed.mfaCode;
      const backupCode = parsed.backupCode;
      if (!mfaCode && !backupCode) {
        return res.status(401).json({ error: "MFA required", mfaRequired: true });
      }
      let mfaOk = false;
      if (mfaCode && user.mfaSecret) {
        mfaOk = verifyMfaToken(user.mfaSecret, mfaCode);
      }
      if (!mfaOk && backupCode) {
        const hashed = hashBackupCode(backupCode);
        if (user.mfaBackupCodes?.includes(hashed)) {
          user.mfaBackupCodes = user.mfaBackupCodes.filter((code) => code !== hashed);
          mfaOk = true;
        }
      }
      if (!mfaOk) return res.status(401).json({ error: "Invalid MFA code" });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled }
    });
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

router.post("/forgot", authLimiter, authSlowDown, async (req, res) => {
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

router.post("/reset", authLimiter, authSlowDown, async (req, res) => {
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

router.post("/mfa/setup", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const secret = speakeasy.generateSecret({
      name: `INVOX (${user.email})`,
      length: 20
    });
    user.mfaTempSecret = secret.base32;
    await user.save();
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ otpauthUrl: secret.otpauth_url, qrDataUrl });
  } catch (err) {
    return handleRouteError(res, err, "Failed to start MFA setup");
  }
});

router.post("/mfa/verify", requireAuth, async (req, res) => {
  try {
    const parsed = MfaVerifySchema.parse(req.body);
    const user = await User.findById(req.user._id);
    if (!user || !user.mfaTempSecret) return res.status(400).json({ error: "MFA setup not initialized" });

    const ok = verifyMfaToken(user.mfaTempSecret, parsed.token);
    if (!ok) return res.status(400).json({ error: "Invalid MFA token" });

    const { codes, hashes } = generateBackupCodes();
    user.mfaSecret = user.mfaTempSecret;
    user.mfaTempSecret = undefined;
    user.mfaEnabled = true;
    user.mfaBackupCodes = hashes;
    await user.save();
    res.json({ ok: true, backupCodes: codes });
  } catch (err) {
    return handleRouteError(res, err, "Failed to verify MFA");
  }
});

router.post("/mfa/disable", requireAuth, async (req, res) => {
  try {
    const parsed = MfaDisableSchema.parse(req.body);
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const ok = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid password" });

    let mfaOk = false;
    if (parsed.token && user.mfaSecret) {
      mfaOk = verifyMfaToken(user.mfaSecret, parsed.token);
    }
    if (!mfaOk && parsed.backupCode) {
      const hashed = hashBackupCode(parsed.backupCode);
      if (user.mfaBackupCodes?.includes(hashed)) {
        user.mfaBackupCodes = user.mfaBackupCodes.filter((code) => code !== hashed);
        mfaOk = true;
      }
    }
    if (!mfaOk) return res.status(401).json({ error: "Invalid MFA token" });

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaTempSecret = undefined;
    user.mfaBackupCodes = [];
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to disable MFA");
  }
});

router.post("/mfa/backup", requireAuth, async (req, res) => {
  try {
    const parsed = MfaDisableSchema.parse(req.body);
    const user = await User.findById(req.user._id);
    if (!user || !user.mfaEnabled) return res.status(400).json({ error: "MFA not enabled" });
    const ok = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid password" });
    const okTotp = parsed.token && user.mfaSecret ? verifyMfaToken(user.mfaSecret, parsed.token) : false;
    if (!okTotp) return res.status(401).json({ error: "Invalid MFA token" });

    const { codes, hashes } = generateBackupCodes();
    user.mfaBackupCodes = hashes;
    await user.save();
    res.json({ ok: true, backupCodes: codes });
  } catch (err) {
    return handleRouteError(res, err, "Failed to regenerate backup codes");
  }
});

module.exports = router;
