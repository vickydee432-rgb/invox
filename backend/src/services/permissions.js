function normalizePermissions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => String(p || "").trim())
    .filter(Boolean);
}

function defaultPermissionsForRole(role) {
  if (role === "super_admin" || role === "owner" || role === "admin") return ["*"];
  // Members can use workspace modules by default, but cannot access admin-only settings/billing.
  return ["module:*:read", "module:*:write"];
}

function computeUserPermissions(user) {
  if (!user) return [];
  if (user.role === "super_admin" || user.role === "owner" || user.role === "admin") return ["*"];
  const explicit = normalizePermissions(user.permissions);
  if (explicit.length) return explicit;
  return defaultPermissionsForRole(user.role);
}

function matchesPattern(pattern, permission) {
  if (!pattern) return false;
  if (pattern === "*") return true;
  if (pattern === permission) return true;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const re = new RegExp(`^${escaped}$`);
  return re.test(permission);
}

function hasPermission(user, permission) {
  const perms = computeUserPermissions(user);
  return perms.some((pattern) => matchesPattern(pattern, permission));
}

module.exports = { computeUserPermissions, hasPermission, normalizePermissions };
