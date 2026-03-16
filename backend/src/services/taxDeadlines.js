const TaxDeadline = require("../models/TaxDeadline");
const FiscalYear = require("../models/FiscalYear");

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function setDayOfMonth(date, day) {
  return new Date(date.getFullYear(), date.getMonth(), day);
}

function defaultNotifyDays(taxType) {
  if (taxType === "income_annual") return [30];
  if (taxType === "provisional") return [7, 5];
  if (taxType === "vat") return [5, 3];
  if (taxType === "paye") return [5, 3];
  if (taxType === "wht") return [5, 3];
  if (taxType === "turnover") return [5, 3];
  return [7];
}

async function seedMonthlyDeadlines({ companyId, workspaceId, taxType, dayOfMonth, monthsAhead }) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = [];
  for (let i = 0; i <= monthsAhead; i += 1) {
    const month = addMonths(start, i);
    const dueDate = setDayOfMonth(addMonths(month, 1), dayOfMonth); // "following month"
    const periodStart = startOfDay(month);
    const periodEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
    rows.push({
      companyId,
      workspaceId,
      taxType,
      title: `${taxType.toUpperCase()} filing`,
      dueDate,
      periodStart,
      periodEnd,
      notifyDaysBefore: defaultNotifyDays(taxType),
      channels: { inApp: true, email: false, sms: false },
      status: "pending"
    });
  }
  return upsertDeadlines(rows);
}

async function seedProvisionalDeadlines({ companyId, workspaceId, yearsAhead = 2 }) {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const rows = [];
  const dueMonths = [
    { month: 0, day: 10, label: "Q4/Jan" },
    { month: 3, day: 10, label: "Q1/Apr" },
    { month: 6, day: 10, label: "Q2/Jul" },
    { month: 9, day: 10, label: "Q3/Oct" }
  ];
  for (let y = 0; y <= yearsAhead; y += 1) {
    const year = yearStart.getFullYear() + y;
    for (const due of dueMonths) {
      const dueDate = new Date(year, due.month, due.day);
      if (dueDate < addDays(startOfDay(now), -30)) continue;
      rows.push({
        companyId,
        workspaceId,
        taxType: "provisional",
        title: `Provisional tax payment (${due.label})`,
        dueDate,
        notifyDaysBefore: defaultNotifyDays("provisional"),
        channels: { inApp: true, email: false, sms: false },
        status: "pending"
      });
    }
  }
  return upsertDeadlines(rows);
}

async function seedAnnualIncomeDeadlines({ companyId, workspaceId }) {
  const years = await FiscalYear.find({ companyId, isActive: true }).sort({ endDate: -1 }).limit(3).lean();
  const rows = [];
  for (const fy of years) {
    const dueDate = addMonths(startOfDay(new Date(fy.endDate)), 6); // default: 6 months after year-end
    rows.push({
      companyId,
      workspaceId,
      taxType: "income_annual",
      title: `Annual income tax return (${fy.name})`,
      dueDate,
      periodStart: fy.startDate,
      periodEnd: fy.endDate,
      notifyDaysBefore: defaultNotifyDays("income_annual"),
      channels: { inApp: true, email: false, sms: false },
      status: "pending"
    });
  }
  return upsertDeadlines(rows);
}

async function upsertDeadlines(rows) {
  if (!rows || rows.length === 0) return { created: 0 };
  let created = 0;
  for (const row of rows) {
    try {
      const result = await TaxDeadline.updateOne(
        { companyId: row.companyId, taxType: row.taxType, dueDate: row.dueDate },
        { $setOnInsert: row },
        { upsert: true }
      );
      created += Number(result?.upsertedCount || 0);
    } catch (err) {
      // ignore duplicate key races
    }
  }
  return { created };
}

async function ensureTaxDeadlinesForCompany(companyId, workspaceId) {
  const ws = workspaceId || String(companyId);
  await seedMonthlyDeadlines({ companyId, workspaceId: ws, taxType: "paye", dayOfMonth: 10, monthsAhead: 18 });
  await seedMonthlyDeadlines({ companyId, workspaceId: ws, taxType: "vat", dayOfMonth: 18, monthsAhead: 18 });
  await seedMonthlyDeadlines({ companyId, workspaceId: ws, taxType: "wht", dayOfMonth: 14, monthsAhead: 18 });
  await seedMonthlyDeadlines({ companyId, workspaceId: ws, taxType: "turnover", dayOfMonth: 14, monthsAhead: 18 });
  await seedProvisionalDeadlines({ companyId, workspaceId: ws, yearsAhead: 2 });
  await seedAnnualIncomeDeadlines({ companyId, workspaceId: ws });
}

module.exports = {
  defaultNotifyDays,
  ensureTaxDeadlinesForCompany,
  startOfDay,
  addDays
};
