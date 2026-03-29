const DEFAULT_LABELS = {
  dashboard: "Dashboard",
  quotes: "Quotes",
  sales: "Sales",
  invoices: "Invoices",
  invoiceSingular: "Invoice",
  customers: "Customers",
  repairs: "Repairs",
  tradeins: "Trade-ins",
  installments: "Installments",
  expenses: "Expenses",
  projects: "Projects",
  reports: "Reports",
  inventory: "Inventory"
};

const BUSINESS_DEFAULTS = {
  construction: {
    businessType: "construction",
    enabledModules: [
      "quotes",
      "invoices",
      "expenses",
      "projects",
      "reports",
      "accounting",
      "purchases",
      "payroll",
      "banking",
      "tax",
      "documents",
      "notifications"
    ],
    labels: { ...DEFAULT_LABELS },
    taxEnabled: true,
    inventoryEnabled: false,
    projectTrackingEnabled: true
  },
  retail: {
    businessType: "retail",
    enabledModules: [
      "sales",
      "invoices",
      "customers",
      "repairs",
      "tradeins",
      "installments",
      "expenses",
      "inventory",
      "reports",
      "accounting",
      "purchases",
      "payroll",
      "banking",
      "tax",
      "documents",
      "notifications"
    ],
    labels: {
      ...DEFAULT_LABELS,
      sales: "Sales",
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
    enabledModules: [
      "quotes",
      "invoices",
      "expenses",
      "projects",
      "reports",
      "accounting",
      "purchases",
      "payroll",
      "banking",
      "tax",
      "documents",
      "notifications"
    ],
    labels: { ...DEFAULT_LABELS },
    taxEnabled: true,
    inventoryEnabled: false,
    projectTrackingEnabled: true
  },
  services: {
    businessType: "services",
    enabledModules: [
      "quotes",
      "invoices",
      "expenses",
      "reports",
      "accounting",
      "purchases",
      "payroll",
      "banking",
      "tax",
      "documents",
      "notifications"
    ],
    labels: { ...DEFAULT_LABELS },
    taxEnabled: true,
    inventoryEnabled: false,
    projectTrackingEnabled: false
  },
  freelance: {
    businessType: "freelance",
    enabledModules: [
      "quotes",
      "invoices",
      "expenses",
      "reports",
      "accounting",
      "purchases",
      "payroll",
      "banking",
      "tax",
      "documents",
      "notifications"
    ],
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
