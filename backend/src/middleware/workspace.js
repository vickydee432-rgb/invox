const Company = require("../models/Company");
const { buildWorkspaceDefaults } = require("../services/workspace");

async function resolveWorkspace(req) {
  if (req.workspace) return req.workspace;
  const company = await Company.findById(req.user.companyId).lean();
  if (!company) return null;
  const defaults = buildWorkspaceDefaults(company.businessType || "construction");
  const workspace = {
    businessType: company.businessType || defaults.businessType,
    enabledModules: company.enabledModules?.length ? company.enabledModules : defaults.enabledModules,
    labels: { ...defaults.labels, ...(company.labels || {}) },
    taxEnabled: company.taxEnabled ?? defaults.taxEnabled,
    inventoryEnabled: company.inventoryEnabled ?? defaults.inventoryEnabled,
    projectTrackingEnabled: company.projectTrackingEnabled ?? defaults.projectTrackingEnabled
  };
  req.workspace = workspace;
  return workspace;
}

function requireModule(moduleKey) {
  return async (req, res, next) => {
    try {
      const workspace = await resolveWorkspace(req);
      if (!workspace) return res.status(404).json({ error: "Company not found" });
      if (!workspace.enabledModules.includes(moduleKey)) {
        return res.status(403).json({ error: `${moduleKey} module disabled` });
      }
      if (moduleKey === "inventory" && !workspace.inventoryEnabled) {
        return res.status(403).json({ error: "Inventory disabled" });
      }
      if (moduleKey === "projects" && !workspace.projectTrackingEnabled) {
        return res.status(403).json({ error: "Project tracking disabled" });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function requireTaxEnabled() {
  return async (req, res, next) => {
    try {
      const workspace = await resolveWorkspace(req);
      if (!workspace) return res.status(404).json({ error: "Company not found" });
      if (!workspace.taxEnabled) {
        return res.status(403).json({ error: "Tax features disabled" });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { resolveWorkspace, requireModule, requireTaxEnabled };
