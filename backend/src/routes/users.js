const express = require("express");
const { z } = require("zod");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Company = require("../models/Company");
const UserInvite = require("../models/UserInvite");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const { handleRouteError } = require("./_helpers");
const { getSeatLimit, countSeatsUsed } = require("../services/planLimits");

const router = express.Router();

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).optional()
});

const AcceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2),
  password: z.string().min(8)
});

function signToken(user) {
  const secret = process.env.AUTH_JWT_SECRET;
  const ttl = process.env.AUTH_TOKEN_TTL || "7d";
  return jwt.sign({ sub: user._id.toString(), email: user.email }, secret, { expiresIn: ttl });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildInviteUrl(req, token) {
  const base =
    req.headers.origin ||
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base}/invite?token=${token}`;
}

router.post("/invite/accept", async (req, res) => {
  try {
    const parsed = AcceptSchema.parse(req.body || {});
    const tokenHash = hashToken(parsed.token);
    const invite = await UserInvite.findOne({
      tokenHash,
      revokedAt: null,
      acceptedAt: null,
      expiresAt: { $gt: new Date() }
    });
    if (!invite) return res.status(400).json({ error: "Invite is invalid or expired" });

    const existing = await User.findOne({ email: invite.email });
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const company = await Company.findById(invite.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const seatLimit = getSeatLimit(company);
    const seatsUsed = await countSeatsUsed(company._id);
    if (seatLimit !== null && seatsUsed >= seatLimit) {
      return res.status(403).json({ error: "Seat limit reached for this plan" });
    }

    const passwordHash = await require("bcryptjs").hash(parsed.password, 12);
    const user = await User.create({
      name: parsed.name.trim(),
      email: invite.email,
      passwordHash,
      companyId: invite.companyId,
      role: invite.role || "member",
      passwordChangedAt: new Date()
    });

    invite.acceptedAt = new Date();
    await invite.save();

    const token = signToken(user);
    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to accept invite");
  }
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const [users, invites, company] = await Promise.all([
      User.find({ companyId: req.user.companyId })
        .select("_id name email role createdAt")
        .sort({ createdAt: 1 })
        .lean(),
      UserInvite.find({
        companyId: req.user.companyId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() }
      })
        .select("_id email role createdAt expiresAt")
        .sort({ createdAt: -1 })
        .lean(),
      Company.findById(req.user.companyId).lean()
    ]);
    const seatLimit = getSeatLimit(company);
    const seatsUsed = users.length + invites.length;
    res.json({ users, invites, seatsUsed, seatLimit });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load users");
  }
});

router.post("/invite", requireRole(["owner", "admin"]), async (req, res) => {
  try {
    const parsed = InviteSchema.parse(req.body || {});
    const email = parsed.email.toLowerCase();
    const role = parsed.role || "member";

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const seatLimit = getSeatLimit(company);
    const seatsUsed = await countSeatsUsed(company._id);
    if (seatLimit !== null && seatsUsed >= seatLimit) {
      return res.status(403).json({ error: "Seat limit reached for this plan" });
    }

    await UserInvite.updateMany(
      { companyId: company._id, email, acceptedAt: null, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + Number(process.env.INVITE_TTL_DAYS || 7) * 24 * 60 * 60 * 1000);
    const invite = await UserInvite.create({
      companyId: company._id,
      email,
      role,
      tokenHash,
      expiresAt,
      createdBy: req.user._id
    });

    const inviteUrl = buildInviteUrl(req, token);
    const emailResult = { sent: false };

    res.json({
      invite: {
        _id: invite._id,
        email: invite.email,
        role: invite.role,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt
      },
      inviteUrl,
      emailSent: emailResult.sent
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to send invite");
  }
});

router.post("/invite/revoke", requireRole(["owner", "admin"]), async (req, res) => {
  try {
    const { inviteId } = req.body || {};
    if (!inviteId) return res.status(400).json({ error: "inviteId is required" });
    const invite = await UserInvite.findOne({ _id: inviteId, companyId: req.user.companyId });
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    invite.revokedAt = new Date();
    await invite.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to revoke invite");
  }
});

router.put("/role", requireRole(["owner"]), async (req, res) => {
  try {
    const { userId, role } = req.body || {};
    if (!userId || !role) return res.status(400).json({ error: "userId and role are required" });
    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const user = await User.findOne({ _id: userId, companyId: req.user.companyId });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "owner" && role !== "owner") {
      return res.status(400).json({ error: "Cannot change owner role" });
    }
    user.role = role;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update role");
  }
});

module.exports = router;
