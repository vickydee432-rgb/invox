const AuditLog = require("../models/AuditLog");
const Company = require("../models/Company");
const { sanitizeAuditPayload } = require("./masking");

const DEFAULT_RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS || process.env.DATA_RETENTION_DAYS || 365);
const DEFAULT_REGION = process.env.DATA_REGION_DEFAULT || "global";

function shouldAuditRequest(req) {
  if (!req) return false;
  if (!req.user) return false;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return false;
  const path = req.path || "";
  const blocked = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot",
    "/api/auth/reset",
    "/api/billing/dodo/webhook"
  ];
  return !blocked.some((prefix) => path.startsWith(prefix));
}

function deriveEntityType(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  if (parts[0] === "api") return parts[1] || "unknown";
  return parts[0] || "unknown";
}

function deriveEntityId(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  if (parts[0] === "api" && parts[2]) return parts[2];
  return undefined;
}

async function logAuditFromRequest(req, res) {
  try {
    const company = req.user?.companyId
      ? await Company.findById(req.user.companyId).select("dataRetentionDays dataRegion").lean()
      : null;
    const retentionDays = company?.dataRetentionDays || DEFAULT_RETENTION_DAYS;
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
    const path = req.originalUrl?.split("?")[0] || req.path;

    await AuditLog.create({
      companyId: req.user?.companyId,
      actorId: req.user?._id,
      actorEmail: req.user?.email,
      action: `${req.method} ${path}`,
      entityType: deriveEntityType(path),
      entityId: deriveEntityId(path),
      ip: req.headers["x-forwarded-for"] || req.ip,
      userAgent: req.headers["user-agent"],
      statusCode: res?.statusCode,
      metadata: sanitizeAuditPayload(req.body),
      dataRegion: company?.dataRegion || DEFAULT_REGION,
      expiresAt
    });
  } catch (err) {
    console.error("Audit log failed", err?.message || err);
  }
}

module.exports = { shouldAuditRequest, logAuditFromRequest };
