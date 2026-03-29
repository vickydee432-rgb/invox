const PLAN_KEYS = ["starter", "pro", "businessplus"];

const PLAN_ALLOWED_MODULES = {
  starter: [
    "quotes",
    "invoices",
    "sales",
    "customers",
    "expenses",
    "inventory",
    "purchases",
    "documents"
  ],
  pro: [
    "quotes",
    "invoices",
    "sales",
    "customers",
    "repairs",
    "tradeins",
    "installments",
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
    "customers",
    "repairs",
    "tradeins",
    "installments",
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

function normalizePlanKey(value) {
  const key = String(value || "").toLowerCase().trim();
  if (PLAN_KEYS.includes(key)) return key;
  return "starter";
}

function getAllowedModules(value) {
  const planKey = normalizePlanKey(value);
  return PLAN_ALLOWED_MODULES[planKey] || PLAN_ALLOWED_MODULES.starter;
}

function clampModules(modules, planValue) {
  const list = Array.isArray(modules) ? modules : [];
  const allowed = new Set(getAllowedModules(planValue));
  return list.filter((key) => allowed.has(key));
}

function isBusinessPlus(planValue) {
  return normalizePlanKey(planValue) === "businessplus";
}

module.exports = {
  normalizePlanKey,
  getAllowedModules,
  clampModules,
  isBusinessPlus
};
