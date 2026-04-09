const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const SuperAdminSsoCode = require("../models/SuperAdminSsoCode");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const { handleRouteError } = require("./_helpers");

const router = express.Router();

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

router.post("/start", requireAuth, requireRole(["super_admin"]), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("_id role").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "super_admin") return res.status(403).json({ error: "Insufficient permissions" });

    const code = crypto.randomBytes(32).toString("hex");
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await SuperAdminSsoCode.create({
      codeHash,
      userId: req.user._id,
      expiresAt
    });

    res.json({ code, expiresAt });
  } catch (err) {
    return handleRouteError(res, err, "Failed to start SSO");
  }
});

router.post("/exchange", async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim();
    if (!code) return res.status(400).json({ error: "code is required" });
    const codeHash = hashCode(code);

    const record = await SuperAdminSsoCode.findOne({
      codeHash,
      expiresAt: { $gt: new Date() },
      usedAt: null
    });
    if (!record) return res.status(400).json({ error: "SSO code is invalid or expired" });

    record.usedAt = new Date();
    await record.save();

    const user = await User.findById(record.userId).select("_id name email role").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "super_admin") return res.status(403).json({ error: "Insufficient permissions" });

    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "AUTH_JWT_SECRET not configured" });
    const ttl = process.env.AUTH_TOKEN_TTL || "7d";
    const token = jwt.sign({ sub: user._id.toString(), email: user.email }, secret, { expiresIn: ttl });

    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to exchange SSO code");
  }
});

module.exports = router;

