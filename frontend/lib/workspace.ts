import { clampModulesByPlan } from "./plans";

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
  inventory: "Inventory",
  accounting: "Accounting",
  purchases: "Purchases",
  payroll: "Payroll",
  banking: "Banking",
  tax: "Tax",
  documents: "Documents",
  notifications: "Notifications"
};

const DEFAULTS: Record<string, WorkspaceConfig> = {
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

export function buildWorkspace(company: any): WorkspaceConfig {
  const businessType = (company?.businessType as WorkspaceConfig["businessType"]) || "construction";
  const defaults = DEFAULTS[businessType] || DEFAULTS.construction;
  const enabledModules = company?.enabledModules?.length ? company.enabledModules : defaults.enabledModules;
  const normalizedModules =
    businessType === "retail" && enabledModules.includes("invoices") && !enabledModules.includes("sales")
      ? [...enabledModules, "sales"]
      : enabledModules;
  const plannedModules = clampModulesByPlan(normalizedModules, company?.subscriptionPlan);
  return {
    businessType,
    enabledModules: plannedModules,
    labels: { ...defaults.labels, ...(company?.labels || {}) },
    taxEnabled: company?.taxEnabled ?? defaults.taxEnabled,
    inventoryEnabled: company?.inventoryEnabled ?? defaults.inventoryEnabled,
    projectTrackingEnabled: company?.projectTrackingEnabled ?? defaults.projectTrackingEnabled
  };
}
