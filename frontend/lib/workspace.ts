export type WorkspaceConfig = {
  businessType: "retail" | "construction" | "agency" | "services" | "freelance";
  enabledModules: string[];
  labels: Record<string, string>;
  taxEnabled: boolean;
  inventoryEnabled: boolean;
  projectTrackingEnabled: boolean;
};

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

const DEFAULTS: Record<string, WorkspaceConfig> = {
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

export function buildWorkspace(company: any): WorkspaceConfig {
  const businessType = (company?.businessType as WorkspaceConfig["businessType"]) || "construction";
  const defaults = DEFAULTS[businessType] || DEFAULTS.construction;
  return {
    businessType,
    enabledModules: company?.enabledModules?.length ? company.enabledModules : defaults.enabledModules,
    labels: { ...defaults.labels, ...(company?.labels || {}) },
    taxEnabled: company?.taxEnabled ?? defaults.taxEnabled,
    inventoryEnabled: company?.inventoryEnabled ?? defaults.inventoryEnabled,
    projectTrackingEnabled: company?.projectTrackingEnabled ?? defaults.projectTrackingEnabled
  };
}
