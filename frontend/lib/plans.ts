export type PlanKey = "starter" | "pro" | "businessplus";

export const PLAN_LABEL: Record<PlanKey, string> = {
  starter: "Starter",
  pro: "Pro",
  businessplus: "BusinessPlus"
};

export const PLAN_SEATS: Record<PlanKey, number> = {
  starter: 1,
  pro: 5,
  businessplus: 15
};

export const PLAN_ALLOWED_MODULES: Record<PlanKey, string[]> = {
  starter: ["quotes", "invoices", "sales", "expenses", "inventory", "purchases", "documents"],
  pro: [
    "quotes",
    "invoices",
    "sales",
    "expenses",
    "inventory",
    "purchases",
    "documents",
    "projects",
    "reports",
    "tax",
    "notifications"
  ],
  businessplus: [
    "quotes",
    "invoices",
    "sales",
    "expenses",
    "inventory",
    "purchases",
    "documents",
    "projects",
    "reports",
    "tax",
    "notifications",
    "accounting",
    "payroll",
    "banking"
  ]
};

export function normalizePlanKey(value: unknown): PlanKey {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "starter" || raw === "pro" || raw === "businessplus") return raw;
  return "starter";
}

export function clampModulesByPlan(modules: string[], planValue: unknown) {
  const plan = normalizePlanKey(planValue);
  const allowed = new Set(PLAN_ALLOWED_MODULES[plan]);
  return (modules || []).filter((key) => allowed.has(key));
}

export function minPlanForModule(moduleKey: string): PlanKey {
  if (["accounting", "payroll", "banking"].includes(moduleKey)) return "businessplus";
  if (["projects", "reports", "tax", "notifications"].includes(moduleKey)) return "pro";
  return "starter";
}

