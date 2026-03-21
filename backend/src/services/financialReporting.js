const Invoice = require("../models/Invoice");
const Expense = require("../models/Expense");
const Payment = require("../models/Payment");
const SupplierInvoice = require("../models/SupplierInvoice");
const { withWorkspaceScope } = require("./scope");

const REVENUE_STATUSES = [
  "sent",
  "paid",
  "partial",
  "overdue",
  "imported_pending",
  "imported_approved"
];

function buildRangeMatch(field, fromDate, toDate) {
  if (!fromDate && !toDate) return {};
  const range = {};
  if (fromDate) range.$gte = fromDate;
  if (toDate) range.$lte = toDate;
  return { [field]: range };
}

function invoiceRevenueMatch({ companyId, workspaceId, fromDate, toDate, asAt }) {
  const match = withWorkspaceScope(
    {
      companyId,
      deletedAt: null,
      invoiceType: "sale",
      status: { $in: REVENUE_STATUSES }
    },
    workspaceId
  );

  if (asAt) {
    match.issueDate = { $lte: asAt };
  } else {
    Object.assign(match, buildRangeMatch("issueDate", fromDate, toDate));
  }
  return match;
}

function invoiceArMatch({ companyId, workspaceId, asAt }) {
  const match = withWorkspaceScope(
    {
      companyId,
      deletedAt: null,
      invoiceType: "sale",
      status: { $in: REVENUE_STATUSES },
      issueDate: { $lte: asAt },
      balance: { $gt: 0 }
    },
    workspaceId
  );
  return match;
}

function expenseMatch({ companyId, workspaceId, fromDate, toDate, asAt }) {
  const match = withWorkspaceScope({ companyId, deletedAt: null }, workspaceId);
  if (asAt) {
    match.date = { $lte: asAt };
  } else {
    Object.assign(match, buildRangeMatch("date", fromDate, toDate));
  }
  return match;
}

function paymentMatch({ companyId, workspaceId, fromDate, toDate, asAt }) {
  const match = withWorkspaceScope({ companyId, deletedAt: null }, workspaceId);
  if (asAt) {
    match.date = { $lte: asAt };
  } else {
    Object.assign(match, buildRangeMatch("date", fromDate, toDate));
  }
  return match;
}

function legacyInvoiceCashMatch({ companyId, workspaceId, fromDate, toDate, asAt }) {
  const match = withWorkspaceScope(
    {
      companyId,
      deletedAt: null,
      invoiceType: "sale",
      status: "paid"
    },
    workspaceId
  );
  if (asAt) {
    match.updatedAt = { $lte: asAt };
  } else {
    Object.assign(match, buildRangeMatch("updatedAt", fromDate, toDate));
  }
  return match;
}

async function sumLegacyPaidInvoicesWithoutPayments(companyId, workspaceId, { fromDate, toDate, asAt } = {}) {
  const match = legacyInvoiceCashMatch({ companyId, workspaceId, fromDate, toDate, asAt });
  const rows = await Invoice.aggregate([
    { $match: match },
    {
      $lookup: {
        from: Payment.collection.name,
        let: { invoiceId: "$_id", companyId: "$companyId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$invoiceId", "$$invoiceId"] },
                  { $eq: ["$companyId", "$$companyId"] },
                  { $eq: ["$deletedAt", null] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "paymentProbe"
      }
    },
    { $match: { paymentProbe: { $eq: [] } } },
    { $group: { _id: null, total: { $sum: "$total" } } }
  ]);
  return rows[0]?.total || 0;
}

function toSeriesKeyExpression(groupBy, field) {
  if (groupBy === "year") {
    return { $dateToString: { format: "%Y", date: `$${field}` } };
  }
  if (groupBy === "quarter") {
    return {
      $concat: [
        { $toString: { $year: `$${field}` } },
        "-Q",
        {
          $toString: {
            $ceil: { $divide: [{ $month: `$${field}` }, 3] }
          }
        }
      ]
    };
  }
  return { $dateToString: { format: "%Y-%m", date: `$${field}` } };
}

async function getTotalRevenue(companyId, workspaceId, fromDate, toDate) {
  const match = invoiceRevenueMatch({ companyId, workspaceId, fromDate, toDate });
  const rows = await Invoice.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$total" } } }]);
  return rows[0]?.total || 0;
}

async function getTotalExpenses(companyId, workspaceId, fromDate, toDate) {
  const match = expenseMatch({ companyId, workspaceId, fromDate, toDate });
  const rows = await Expense.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
  return rows[0]?.total || 0;
}

async function getIncomeStatement(
  companyId,
  workspaceId,
  { fromDate, toDate, groupBy = "month", limit = 200, includeInvoices = true } = {}
) {
  const invoiceMatch = invoiceRevenueMatch({ companyId, workspaceId, fromDate, toDate });
  const expMatch = expenseMatch({ companyId, workspaceId, fromDate, toDate });

  const invoiceLimit = Math.min(1000, Math.max(0, Number(limit) || 200));
  const [
    revenueAgg,
    expenseAgg,
    revenueByInvoice,
    expensesByCategory,
    revenueSeries,
    expenseSeries
  ] = await Promise.all([
    Invoice.aggregate([{ $match: invoiceMatch }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Expense.aggregate([{ $match: expMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    includeInvoices
      ? Invoice.find(invoiceMatch)
          .select("_id invoiceNo customerName issueDate status subtotal vatAmount total amountPaid balance")
          .sort({ issueDate: 1, invoiceNo: 1 })
          .limit(invoiceLimit)
          .lean()
      : Promise.resolve([]),
    Expense.aggregate([
      { $match: expMatch },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $group: { _id: toSeriesKeyExpression(groupBy, "issueDate"), revenue: { $sum: "$total" } } },
      { $sort: { _id: 1 } }
    ]),
    Expense.aggregate([
      { $match: expMatch },
      { $group: { _id: toSeriesKeyExpression(groupBy, "date"), expenses: { $sum: "$amount" } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const totalExpenses = expenseAgg[0]?.total || 0;
  const netProfit = totalRevenue - totalExpenses;

  const seriesMap = new Map();
  revenueSeries.forEach((row) => {
    seriesMap.set(String(row._id), { period: String(row._id), revenue: row.revenue || 0, expenses: 0, profit: 0 });
  });
  expenseSeries.forEach((row) => {
    const key = String(row._id);
    const existing = seriesMap.get(key) || { period: key, revenue: 0, expenses: 0, profit: 0 };
    existing.expenses = row.expenses || 0;
    seriesMap.set(key, existing);
  });
  const series = Array.from(seriesMap.values())
    .map((row) => ({ ...row, profit: (row.revenue || 0) - (row.expenses || 0) }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return {
    range: { from: fromDate ? fromDate.toISOString() : null, to: toDate ? toDate.toISOString() : null },
    totals: { totalRevenue, totalExpenses, netProfit },
    breakdown: {
      revenueByInvoice,
      expensesByCategory: expensesByCategory.map((row) => ({
        category: row._id || "Uncategorized",
        total: row.total || 0,
        count: row.count || 0
      }))
    },
    series
  };
}

function previousPeriod(fromDate, toDate) {
  if (!fromDate || !toDate) return { from: null, to: null };
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: prevFrom, to: prevTo };
}

async function getIncomeStatementWithComparison(companyId, workspaceId, { fromDate, toDate, groupBy = "month", limit = 200 } = {}) {
  const current = await getIncomeStatement(companyId, workspaceId, { fromDate, toDate, groupBy, limit, includeInvoices: true });
  const prev = previousPeriod(fromDate, toDate);
  const previous =
    prev.from && prev.to
      ? await getIncomeStatement(companyId, workspaceId, { fromDate: prev.from, toDate: prev.to, groupBy, limit: 0, includeInvoices: false })
      : null;

  return {
    ...current,
    comparison: previous
      ? {
          previousRange: { from: prev.from.toISOString(), to: prev.to.toISOString() },
          previousTotals: previous.totals,
          deltas: {
            revenue: current.totals.totalRevenue - previous.totals.totalRevenue,
            expenses: current.totals.totalExpenses - previous.totals.totalExpenses,
            netProfit: current.totals.netProfit - previous.totals.netProfit
          }
        }
      : null
  };
}

async function getCashFlow(companyId, workspaceId, { fromDate, toDate } = {}) {
  const payMatch = paymentMatch({ companyId, workspaceId, fromDate, toDate });
  const expMatch = expenseMatch({ companyId, workspaceId, fromDate, toDate });

  const [paymentsAgg, legacyPaidInvoices, cashOutAgg] = await Promise.all([
    Payment.aggregate([{ $match: payMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    sumLegacyPaidInvoicesWithoutPayments(companyId, workspaceId, { fromDate, toDate }),
    Expense.aggregate([{ $match: expMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }])
  ]);

  const paymentsTotal = paymentsAgg[0]?.total || 0;
  const cashIn = paymentsTotal + (legacyPaidInvoices || 0);
  const cashOut = cashOutAgg[0]?.total || 0;
  const netCashFlow = cashIn - cashOut;

  let openingCash = 0;
  if (fromDate) {
    const openingTo = new Date(fromDate.getTime() - 1);
    const [openingPaymentsAgg, openingLegacyInvoices, openingOutAgg] = await Promise.all([
      Payment.aggregate([
        { $match: paymentMatch({ companyId, workspaceId, toDate: openingTo }) },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      sumLegacyPaidInvoicesWithoutPayments(companyId, workspaceId, { toDate: openingTo }),
      Expense.aggregate([
        { $match: expenseMatch({ companyId, workspaceId, toDate: openingTo }) },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);
    const openingIn = (openingPaymentsAgg[0]?.total || 0) + (openingLegacyInvoices || 0);
    openingCash = openingIn - (openingOutAgg[0]?.total || 0);
  }
  const closingCash = openingCash + netCashFlow;

  return {
    range: { from: fromDate ? fromDate.toISOString() : null, to: toDate ? toDate.toISOString() : null },
    cashIn,
    cashOut,
    netCashFlow,
    openingCash,
    closingCash,
    cashSource: legacyPaidInvoices ? "payments_plus_legacy_paid_invoices" : "payments",
    cashInComponents: {
      payments: paymentsTotal,
      paidInvoicesLegacy: legacyPaidInvoices || 0
    }
  };
}

async function getBalanceSheet(companyId, workspaceId, { asAt } = {}) {
  const asAtDate = asAt || new Date();
  const payMatch = paymentMatch({ companyId, workspaceId, asAt: asAtDate });
  const expMatch = expenseMatch({ companyId, workspaceId, asAt: asAtDate });

  const [cashInAgg, legacyPaidInvoices, cashOutAgg, arAgg, revenueAgg, expenseAgg, liabilityAgg] = await Promise.all([
    Payment.aggregate([{ $match: payMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    sumLegacyPaidInvoicesWithoutPayments(companyId, workspaceId, { asAt: asAtDate }),
    Expense.aggregate([{ $match: expMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Invoice.aggregate([{ $match: invoiceArMatch({ companyId, workspaceId, asAt: asAtDate }) }, { $group: { _id: null, total: { $sum: "$balance" } } }]),
    Invoice.aggregate([{ $match: invoiceRevenueMatch({ companyId, workspaceId, asAt: asAtDate }) }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Expense.aggregate([{ $match: expenseMatch({ companyId, workspaceId, asAt: asAtDate }) }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    SupplierInvoice.aggregate([
      { $match: { companyId, date: { $lte: asAtDate }, status: { $in: ["open", "overdue"] }, balance: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$balance" } } }
    ])
  ]);

  const paymentsToDate = cashInAgg[0]?.total || 0;
  const cashInToDate = paymentsToDate + (legacyPaidInvoices || 0);
  const cashOutToDate = cashOutAgg[0]?.total || 0;
  const cash = cashInToDate - cashOutToDate;
  const accountsReceivable = arAgg[0]?.total || 0;
  const totalAssets = cash + accountsReceivable;

  const liabilities = liabilityAgg[0]?.total || 0;

  const retainedEarnings = (revenueAgg[0]?.total || 0) - (expenseAgg[0]?.total || 0);
  const ownerEquity = totalAssets - liabilities - retainedEarnings;
  const totalEquity = ownerEquity + retainedEarnings;

  const diff = Number((totalAssets - (liabilities + totalEquity)).toFixed(2));

  return {
    asAt: asAtDate.toISOString(),
    assets: {
      cash,
      accountsReceivable,
      total: totalAssets
    },
    liabilities: {
      obligations: liabilities,
      total: liabilities
    },
    equity: {
      ownerEquity,
      retainedEarnings,
      total: totalEquity
    },
    balanced: diff === 0,
    balanceDiff: diff,
    cashSource: legacyPaidInvoices ? "payments_plus_legacy_paid_invoices_minus_expenses" : "payments_minus_expenses",
    cashInComponents: {
      payments: paymentsToDate,
      paidInvoicesLegacy: legacyPaidInvoices || 0,
      expenses: cashOutToDate
    }
  };
}

async function getDashboard(companyId, workspaceId, { fromDate, toDate, groupBy = "month" } = {}) {
  const [income, cashFlow, balance] = await Promise.all([
    getIncomeStatement(companyId, workspaceId, { fromDate, toDate, groupBy, limit: 0, includeInvoices: false }).then(async (base) => {
      const prev = previousPeriod(fromDate, toDate);
      const previous =
        prev.from && prev.to
          ? await getIncomeStatement(companyId, workspaceId, { fromDate: prev.from, toDate: prev.to, groupBy, limit: 0, includeInvoices: false })
          : null;
      return {
        ...base,
        comparison: previous
          ? {
              previousRange: { from: prev.from.toISOString(), to: prev.to.toISOString() },
              previousTotals: previous.totals,
              deltas: {
                revenue: base.totals.totalRevenue - previous.totals.totalRevenue,
                expenses: base.totals.totalExpenses - previous.totals.totalExpenses,
                netProfit: base.totals.netProfit - previous.totals.netProfit
              }
            }
          : null
      };
    }),
    getCashFlow(companyId, workspaceId, { fromDate, toDate }),
    getBalanceSheet(companyId, workspaceId, { asAt: toDate || new Date() })
  ]);

  return {
    range: income.range,
    incomeStatement: income,
    cashFlow,
    balanceSheet: balance,
    summary: {
      totalRevenue: income.totals.totalRevenue,
      totalExpenses: income.totals.totalExpenses,
      netProfit: income.totals.netProfit,
      cashBalance: balance.assets.cash
    }
  };
}

module.exports = {
  buildRangeMatch,
  previousPeriod,
  getTotalRevenue,
  getTotalExpenses,
  getIncomeStatement,
  getIncomeStatementWithComparison,
  getCashFlow,
  getBalanceSheet,
  getDashboard
};
