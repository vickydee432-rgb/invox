const DEFAULT_LABELS = {
  dashboard: "Dashboard",
  quotes: "Quotes",
  invoices: "Invoices",
  invoiceSingular: "Invoice",
  expenses: "Expenses",
  projects: "Projects",
  reports: "Reports",
  inventory: "Inventory"
};

const BUSINESS_DEFAULTS = {
  construction: {
    businessType: "construction",
    enabledModules: ["quotes", "invoices", "expenses", "projects", "reports"],
    labels: { ...DEFAULT_LABELS },
    taxEnabled: true,
    inventoryEnabled: false,
    projectTrackingEnabled: true
  },
  retail: {
    businessType: "retail",
    enabledModules: ["invoices", "expenses", "inventory", "reports"],
    labels: {
      ...DEFAULT_LABELS,
      invoices: "Receipts",
      invoiceSingular: "Receipt",
      dashboard: "Shop Dashboard"
    },
    taxEnabled: false,
    inventoryEnabled: true,
    projectTrackingEnabled: false
  },
  agency: {
    businessType: "agency",
    enabledModules: ["quotes", "invoices", "expenses", "projects", "reports"],
    labels: { ...DEFAULT_LABELS },
    taxEnabled: true,
    inventoryEnabled: false,
    projectTrackingEnabled: true
  },
  services: {
    businessType: "services",
    enabledModules: ["quotes", "invoices", "expenses", "reports"],
    labels: { ...DEFAULT_LABELS },
    taxEnabled: true,
    inventoryEnabled: false,
    projectTrackingEnabled: false
  },
  freelance: {
    businessType: "freelance",
    enabledModules: ["quotes", "invoices", "expenses", "reports"],
    labels: { ...DEFAULT_LABELS },
    taxEnabled: false,
    inventoryEnabled: false,
    projectTrackingEnabled: false
  }
};

function buildWorkspaceDefaults(businessType = "construction") {
  return BUSINESS_DEFAULTS[businessType] || BUSINESS_DEFAULTS.construction;
}

function applyWorkspace(company, businessType, overrides = {}) {
  const defaults = buildWorkspaceDefaults(businessType || company.businessType);
  company.businessType = defaults.businessType;
  company.enabledModules = overrides.enabledModules || defaults.enabledModules;
  company.labels = { ...defaults.labels, ...(overrides.labels || {}) };
  company.taxEnabled = overrides.taxEnabled ?? defaults.taxEnabled;
  company.inventoryEnabled = overrides.inventoryEnabled ?? defaults.inventoryEnabled;
  company.projectTrackingEnabled =
    overrides.projectTrackingEnabled ?? defaults.projectTrackingEnabled;
  company.workspaceConfigured = true;
}

module.exports = { buildWorkspaceDefaults, applyWorkspace };
