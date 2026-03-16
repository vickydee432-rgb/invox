const { hasPermission } = require("../services/permissions");

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    return next();
  };
}

module.exports = { requirePermission };

