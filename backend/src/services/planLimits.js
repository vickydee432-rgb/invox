const User = require("../models/User");
const UserInvite = require("../models/UserInvite");

const DEFAULT_LIMITS = {
  starter: Number(process.env.PLAN_SEATS_STARTER || 1),
  pro: Number(process.env.PLAN_SEATS_PRO || 5),
  businessplus: Number(process.env.PLAN_SEATS_BUSINESSPLUS || 15)
};

function getSeatLimit(company) {
  const plan = company?.subscriptionPlan || "starter";
  const limit = DEFAULT_LIMITS[plan] ?? DEFAULT_LIMITS.starter;
  if (!Number.isFinite(limit)) return 1;
  if (limit <= 0) return null;
  return limit;
}

async function countSeatsUsed(companyId) {
  const [usersCount, invitesCount] = await Promise.all([
    User.countDocuments({ companyId }),
    UserInvite.countDocuments({
      companyId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    })
  ]);
  return usersCount + invitesCount;
}

module.exports = { getSeatLimit, countSeatsUsed };
