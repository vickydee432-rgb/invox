const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." }
});

const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: Number(process.env.AUTH_SLOWDOWN_AFTER || 5),
  delayMs: () => Number(process.env.AUTH_SLOWDOWN_DELAY_MS || 500)
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." }
});

module.exports = { authLimiter, authSlowDown, apiLimiter };
