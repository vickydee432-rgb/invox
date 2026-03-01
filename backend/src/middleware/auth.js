const jwt = require("jsonwebtoken");
const User = require("../models/User");

const jwtErrorNames = new Set(["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"]);

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfigured" });

    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.sub)
      .select("_id name email companyId role mfaEnabled")
      .lean();
    if (!user) return res.status(401).json({ error: "Invalid auth token" });
    req.user = user;
    return next();
  } catch (err) {
    if (jwtErrorNames.has(err?.name)) return res.status(401).json({ error: "Invalid or expired token" });
    return next(err);
  }
}

module.exports = { requireAuth };
