const Company = require("../models/Company");

function computeAccess(company) {
  const now = new Date();
  const trialValid = company.trialEndsAt && company.trialEndsAt > now;
  const periodValid = company.currentPeriodEnd && company.currentPeriodEnd > now;
  const isActive = company.subscriptionStatus === "active" || trialValid || periodValid;
  return { isActive, trialValid, periodValid };
}

async function requireSubscription(req, res, next) {
  try {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const company = await Company.findById(req.user.companyId).lean();
    if (!company) return res.status(400).json({ error: "Company not found" });

    const { isActive } = computeAccess(company);
    if (isActive) return next();

    return res.status(402).json({
      error: "Subscription required. Account is in read-only mode.",
      readOnly: true,
      trialEndsAt: company.trialEndsAt,
      subscriptionStatus: company.subscriptionStatus || "trialing"
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireSubscription, computeAccess };
