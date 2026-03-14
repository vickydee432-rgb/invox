const Account = require("../models/Account");
const Journal = require("../models/Journal");
const JournalLine = require("../models/JournalLine");
const Period = require("../models/Period");
const Company = require("../models/Company");

function sumLines(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.debit += Number(line.debit || 0);
      acc.credit += Number(line.credit || 0);
      return acc;
    },
    { debit: 0, credit: 0 }
  );
}

function ensureBalanced(lines) {
  const totals = sumLines(lines);
  const diff = Math.abs(totals.debit - totals.credit);
  if (diff > 0.01) {
    throw new Error("Journal is not balanced");
  }
}

async function resolvePeriod(companyId, date, session) {
  if (!date) return null;
  const query = {
    companyId,
    startDate: { $lte: date },
    endDate: { $gte: date },
    isClosed: false
  };
  const period = session ? await Period.findOne(query).session(session) : await Period.findOne(query);
  return period ? period._id : null;
}

async function createJournal({
  companyId,
  date,
  refType,
  refId,
  memo,
  lines,
  currency,
  postedBy,
  session
}) {
  ensureBalanced(lines);
  const periodId = await resolvePeriod(companyId, date, session);
  const journal = new Journal({
    companyId,
    date,
    refType,
    refId,
    memo,
    currency,
    periodId,
    postedBy
  });
  if (session) {
    await journal.save({ session });
  } else {
    await journal.save();
  }

  const journalLines = lines.map((line) => ({
    journalId: journal._id,
    companyId,
    accountId: line.accountId,
    debit: Number(line.debit || 0),
    credit: Number(line.credit || 0),
    currency: line.currency || currency,
    exchangeRate: line.exchangeRate || 1
  }));

  if (session) {
    await JournalLine.insertMany(journalLines, { session });
  } else {
    await JournalLine.insertMany(journalLines);
  }

  return journal;
}

async function loadCompany(companyId) {
  const company = await Company.findById(companyId).lean();
  if (!company || !company.accountingEnabled) return null;
  return company;
}

function getDefaultAccount(company, key) {
  const value = company?.accountingDefaults?.[key];
  return value ? String(value) : "";
}

async function validateAccounts(companyId, accountIds) {
  const ids = accountIds.filter(Boolean);
  if (ids.length === 0) return false;
  const count = await Account.countDocuments({ companyId, _id: { $in: ids } });
  return count === ids.length;
}

async function postInvoice({ companyId, invoice }) {
  const company = await loadCompany(companyId);
  if (!company) return { skipped: true, reason: "Accounting disabled" };
  const ar = getDefaultAccount(company, "accountsReceivable");
  const revenue = getDefaultAccount(company, "salesRevenue");
  const vatOutput = getDefaultAccount(company, "vatOutput");
  const accountIds = [ar, revenue, vatOutput].filter(Boolean);
  const valid = await validateAccounts(companyId, accountIds);
  if (!valid) return { skipped: true, reason: "Missing default accounts" };

  const vatAmount = Number(invoice.vatAmount || 0);
  const total = Number(invoice.total || 0);
  const revenueAmount = Math.max(0, total - vatAmount);
  const lines = [
    { accountId: ar, debit: total, credit: 0 },
    { accountId: revenue, debit: 0, credit: revenueAmount }
  ];
  if (vatAmount > 0 && vatOutput) {
    lines.push({ accountId: vatOutput, debit: 0, credit: vatAmount });
  }

  await createJournal({
    companyId,
    date: invoice.issueDate || new Date(),
    refType: "invoice",
    refId: invoice._id,
    memo: `Invoice ${invoice.invoiceNo}`,
    lines,
    currency: company.currency,
    postedBy: invoice.userId || null
  });
  return { posted: true };
}

async function postExpense({ companyId, expense }) {
  const company = await loadCompany(companyId);
  if (!company) return { skipped: true, reason: "Accounting disabled" };
  const expenseAccount = getDefaultAccount(company, "expenses");
  const cashAccount = getDefaultAccount(company, "cash");
  const accountIds = [expenseAccount, cashAccount].filter(Boolean);
  const valid = await validateAccounts(companyId, accountIds);
  if (!valid) return { skipped: true, reason: "Missing default accounts" };
  const amount = Number(expense.amount || 0);

  await createJournal({
    companyId,
    date: expense.date || new Date(),
    refType: "expense",
    refId: expense._id,
    memo: expense.title,
    lines: [
      { accountId: expenseAccount, debit: amount, credit: 0 },
      { accountId: cashAccount, debit: 0, credit: amount }
    ],
    currency: company.currency,
    postedBy: expense.userId || null
  });
  return { posted: true };
}

async function postSupplierInvoice({ companyId, supplierInvoice }) {
  const company = await loadCompany(companyId);
  if (!company) return { skipped: true, reason: "Accounting disabled" };
  const ap = getDefaultAccount(company, "accountsPayable");
  const purchasesExpense = getDefaultAccount(company, "purchasesExpense");
  const vatInput = getDefaultAccount(company, "vatInput");
  const accountIds = [ap, purchasesExpense, vatInput].filter(Boolean);
  const valid = await validateAccounts(companyId, accountIds);
  if (!valid) return { skipped: true, reason: "Missing default accounts" };

  const total = Number(supplierInvoice.total || 0);
  const tax = Number(supplierInvoice.taxAmount || 0);
  const base = Math.max(0, total - tax);
  const lines = [
    { accountId: purchasesExpense, debit: base, credit: 0 },
    { accountId: ap, debit: 0, credit: total }
  ];
  if (tax > 0 && vatInput) {
    lines.push({ accountId: vatInput, debit: tax, credit: 0 });
  }

  await createJournal({
    companyId,
    date: supplierInvoice.date || new Date(),
    refType: "supplier_invoice",
    refId: supplierInvoice._id,
    memo: `Supplier invoice ${supplierInvoice.number}`,
    lines,
    currency: company.currency,
    postedBy: supplierInvoice.createdBy || null
  });
  return { posted: true };
}

async function postPayroll({ companyId, payrun, totals }) {
  const company = await loadCompany(companyId);
  if (!company) return { skipped: true, reason: "Accounting disabled" };
  const payrollExpense = getDefaultAccount(company, "payrollExpense");
  const payePayable = getDefaultAccount(company, "payePayable");
  const napsaPayable = getDefaultAccount(company, "napsaPayable");
  const nimaPayable = getDefaultAccount(company, "nimaPayable");
  const netSalaryPayable = getDefaultAccount(company, "netSalaryPayable");
  const accountIds = [payrollExpense, payePayable, napsaPayable, nimaPayable, netSalaryPayable].filter(Boolean);
  const valid = await validateAccounts(companyId, accountIds);
  if (!valid) return { skipped: true, reason: "Missing default accounts" };

  const lines = [
    { accountId: payrollExpense, debit: totals.gross || 0, credit: 0 },
    { accountId: payePayable, debit: 0, credit: totals.paye || 0 },
    { accountId: napsaPayable, debit: 0, credit: totals.napsa || 0 },
    { accountId: nimaPayable, debit: 0, credit: totals.nima || 0 },
    { accountId: netSalaryPayable, debit: 0, credit: totals.net || 0 }
  ];

  await createJournal({
    companyId,
    date: new Date(),
    refType: "payrun",
    refId: payrun._id,
    memo: `Payroll ${payrun.period}`,
    lines,
    currency: company.currency,
    postedBy: null
  });
  return { posted: true };
}

module.exports = {
  createJournal,
  postInvoice,
  postExpense,
  postSupplierInvoice,
  postPayroll
};
