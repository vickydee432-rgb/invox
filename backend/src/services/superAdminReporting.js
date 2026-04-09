const Invoice = require("../models/Invoice");
const Expense = require("../models/Expense");
const Branch = require("../models/Branch");
const Sale = require("../models/Sale");
const User = require("../models/User");
const Company = require("../models/Company");

function buildDateRangeClause({ field, fromDate, toDate }) {
  const clause = { deletedAt: null };
  if (fromDate || toDate) {
    clause[field] = {};
    if (fromDate) clause[field].$gte = fromDate;
    if (toDate) clause[field].$lte = toDate;
  }
  return clause;
}

function toSeriesKeyExpression(groupBy, field) {
  if (groupBy === "day") return { $dateToString: { format: "%Y-%m-%d", date: `$${field}` } };
  if (groupBy === "week") return {
    $concat: [
      { $toString: { $year: `$${field}` } },
      "-W",
      { $toString: { $week: `$${field}` } }
    ]
  };
  if (groupBy === "month") return { $dateToString: { format: "%Y-%m", date: `$${field}` } };
  if (groupBy === "quarter") {
    return {
      $concat: [
        { $toString: { $year: `$${field}` } },
        "-Q",
        { $toString: { $ceil: { $divide: [{ $month: `$${field}` }, 3] } } }
      ]
    };
  }
  return { $dateToString: { format: "%Y-%m", date: `$${field}` } };
}

function previousPeriodDates(fromDate, toDate) {
  if (!fromDate || !toDate) return { from: null, to: null };
  const duration = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - duration);
  return { from: prevFrom, to: prevTo };
}

async function getSuperAdminOverview({ companyId, fromDate, toDate, groupBy = "month" } = {}) {
  const invoiceMatch = { status: { $nin: ["cancelled"] } };
  if (companyId) invoiceMatch.companyId = companyId;
  if (fromDate || toDate) {
    invoiceMatch.issueDate = {};
    if (fromDate) invoiceMatch.issueDate.$gte = fromDate;
    if (toDate) invoiceMatch.issueDate.$lte = toDate;
  }

  const expenseMatch = {};
  if (companyId) expenseMatch.companyId = companyId;
  if (fromDate || toDate) {
    expenseMatch.date = {};
    if (fromDate) expenseMatch.date.$gte = fromDate;
    if (toDate) expenseMatch.date.$lte = toDate;
  }

  const saleMatch = { status: { $nin: ["cancelled"] } };
  if (companyId) saleMatch.companyId = companyId;
  if (fromDate || toDate) {
    saleMatch.issueDate = {};
    if (fromDate) saleMatch.issueDate.$gte = fromDate;
    if (toDate) saleMatch.issueDate.$lte = toDate;
  }

  const usageWindowDays = Number(process.env.SUPER_ADMIN_USAGE_WINDOW_DAYS || 30);
  const usageSince = new Date(Date.now() - usageWindowDays * 24 * 60 * 60 * 1000);

  const prevRange = previousPeriodDates(fromDate, toDate);
  const prevInvoiceMatch = { ...invoiceMatch };
  const prevExpenseMatch = { ...expenseMatch };
  if (prevRange.from || prevRange.to) {
    prevInvoiceMatch.issueDate = {};
    if (prevRange.from) prevInvoiceMatch.issueDate.$gte = prevRange.from;
    if (prevRange.to) prevInvoiceMatch.issueDate.$lte = prevRange.to;
    prevExpenseMatch.date = {};
    if (prevRange.from) prevExpenseMatch.date.$gte = prevRange.from;
    if (prevRange.to) prevExpenseMatch.date.$lte = prevRange.to;
  }

  const [
    revenueAgg,
    expenseAgg,
    invoiceCount,
    salesAgg,
    salesCount,
    usersCount,
    activeUsersCount,
    activeBranchesCount,
    branchRank,
    prevBranchRank,
    revenueSeries,
    expenseSeries,
    employeePerformance,
    bestProducts,
    topCompanies,
    revenueByCurrency,
    expensesByCurrency,
    activeCompaniesWindow
  ] = await Promise.all([
      Invoice.aggregate([{ $match: invoiceMatch }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Invoice.countDocuments(invoiceMatch),
      Sale.aggregate([{ $match: saleMatch }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      Sale.countDocuments(saleMatch),
      User.countDocuments(companyId ? { companyId } : {}),
      User.countDocuments(
        companyId
          ? { companyId, lastLoginAt: { $gte: usageSince } }
          : { lastLoginAt: { $gte: usageSince } }
      ),
      Branch.countDocuments({ ...(companyId ? { companyId } : {}), isActive: true }),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: "$branchId", name: { $first: "$branchName" }, totalRevenue: { $sum: "$total" }, invoiceCount: { $sum: 1 } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 20 }
      ]),

      Invoice.aggregate([
        { $match: prevInvoiceMatch },
        { $group: { _id: "$branchId", totalRevenue: { $sum: "$total" } } }
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: toSeriesKeyExpression(groupBy, "issueDate"), revenue: { $sum: "$total" } } },
        { $sort: { _id: 1 } }
      ]),

      Expense.aggregate([
        { $match: expenseMatch },
        { $group: { _id: toSeriesKeyExpression(groupBy, "date"), expenses: { $sum: "$amount" } } },
        { $sort: { _id: 1 } }
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: "$salespersonId", totalSales: { $sum: "$total" }, invoices: { $sum: 1 }, avgInvoiceValue: { $avg: "$total" } } },
        { $sort: { totalSales: -1 } },
        { $limit: 20 }
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $unwind: "$items" },
        { $group: { _id: "$items.productId", productName: { $first: "$items.productName" }, quantity: { $sum: "$items.qty" }, revenue: { $sum: "$items.lineTotal" } } },
        { $sort: { revenue: -1 } },
        { $limit: 20 }
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: "$companyId", totalRevenue: { $sum: "$total" }, invoicesCount: { $sum: 1 } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 20 },
        { $lookup: { from: "companies", localField: "_id", foreignField: "_id", as: "company" } },
        { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            companyId: "$_id",
            companyName: { $ifNull: ["$company.name", "Unknown"] },
            currency: "$company.currency",
            subscriptionStatus: "$company.subscriptionStatus",
            subscriptionPlan: "$company.subscriptionPlan",
            subscriptionCycle: "$company.subscriptionCycle",
            totalRevenue: 1,
            invoicesCount: 1
          }
        }
      ]),

      companyId
        ? Promise.resolve([])
        : Invoice.aggregate([
            { $match: invoiceMatch },
            { $group: { _id: "$companyId", revenue: { $sum: "$total" } } },
            { $lookup: { from: "companies", localField: "_id", foreignField: "_id", as: "company" } },
            { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$company.currency", revenue: { $sum: "$revenue" }, companies: { $sum: 1 } } },
            { $project: { _id: 0, currency: "$_id", revenue: 1, companies: 1 } },
            { $sort: { revenue: -1 } }
          ]),

      companyId
        ? Promise.resolve([])
        : Expense.aggregate([
            { $match: expenseMatch },
            { $group: { _id: "$companyId", expenses: { $sum: "$amount" } } },
            { $lookup: { from: "companies", localField: "_id", foreignField: "_id", as: "company" } },
            { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$company.currency", expenses: { $sum: "$expenses" }, companies: { $sum: 1 } } },
            { $project: { _id: 0, currency: "$_id", expenses: 1, companies: 1 } },
            { $sort: { expenses: -1 } }
          ]),

      companyId
        ? Promise.resolve([companyId])
        : Invoice.distinct("companyId", { ...invoiceMatch, issueDate: { $gte: usageSince } })
    ]);

  const totalRevenue = (revenueAgg[0]?.total || 0) + 0;
  const totalExpenses = (expenseAgg[0]?.total || 0) + 0;
  const totalSalesRevenue = (salesAgg[0]?.total || 0) + 0;
  const totalTransactions = invoiceCount + salesCount;

  const seriesMap = new Map();
  revenueSeries.forEach((row) => seriesMap.set(String(row._id), { period: String(row._id), revenue: row.revenue || 0, expenses: 0 }));
  expenseSeries.forEach((row) => {
    const key = String(row._id);
    const existing = seriesMap.get(key) || { period: key, revenue: 0, expenses: 0 };
    existing.expenses = row.expenses || 0;
    seriesMap.set(key, existing);
  });

  const timeseries = Array.from(seriesMap.values()).map((row) => ({ ...row, profit: row.revenue - row.expenses }));

  const employeeUsers = await User.find({ _id: { $in: employeePerformance.map((r) => r._id).filter(Boolean) } })
    .select("_id name email role")
    .lean();

  const employeesIndexed = new Map(employeeUsers.map((u) => [String(u._id), u]));
  const employeeLeaderboard = employeePerformance.map((row) => ({
    userId: row._id,
    name: employeesIndexed.get(String(row._id))?.name || "Unknown",
    role: employeesIndexed.get(String(row._id))?.role || "",
    totalSales: row.totalSales,
    invoices: row.invoices,
    avgInvoiceValue: row.avgInvoiceValue
  }));

  const prevBranchMap = new Map(prevBranchRank.map((row) => [String(row._id || ""), row.totalRevenue || 0]));

  const branchIds = branchRank.map((row) => row._id).filter(Boolean);
  const branches = branchIds.length
    ? await Branch.find({ _id: { $in: branchIds } }).select("_id name").lean()
    : [];
  const branchById = new Map(branches.map((b) => [String(b._id), b]));

  const branchRankExtended = branchRank.map((row) => {
    const branch = row._id ? branchById.get(String(row._id)) : null;
    const previous = prevBranchMap.get(String(row._id || "")) || 0;
    const growthRate = previous > 0 ? ((row.totalRevenue - previous) / previous) * 100 : null;
    return {
      branchId: row._id,
      branchName: branch?.name || row.name || "Unassigned",
      totalRevenue: row.totalRevenue || 0,
      invoiceCount: row.invoiceCount || 0,
      growthRate: growthRate !== null ? Number(growthRate.toFixed(2)) : null
    };
  });

  const trendPeriod = { from: fromDate?.toISOString() || null, to: toDate?.toISOString() || null };
  const companyMeta = companyId ? await Company.findById(companyId).select("currency name").lean() : null;
  const companiesCount = companyId ? (companyMeta ? 1 : 0) : await Company.countDocuments({});
  const currency = companyMeta?.currency || null;
  const activeCompaniesCount = companyId ? (companyMeta ? 1 : 0) : (activeCompaniesWindow || []).length;

  const currencyBreakdownMap = new Map();
  (revenueByCurrency || []).forEach((row) => {
    const key = row.currency || "UNKNOWN";
    currencyBreakdownMap.set(key, {
      currency: key,
      companies: row.companies || 0,
      revenue: row.revenue || 0,
      expenses: 0,
      profit: 0
    });
  });
  (expensesByCurrency || []).forEach((row) => {
    const key = row.currency || "UNKNOWN";
    const existing = currencyBreakdownMap.get(key) || {
      currency: key,
      companies: row.companies || 0,
      revenue: 0,
      expenses: 0,
      profit: 0
    };
    existing.expenses = row.expenses || 0;
    existing.companies = Math.max(existing.companies || 0, row.companies || 0);
    currencyBreakdownMap.set(key, existing);
  });
  let currencyBreakdown = Array.from(currencyBreakdownMap.values())
    .map((row) => ({ ...row, profit: (row.revenue || 0) - (row.expenses || 0) }))
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  if (companyId && currency) {
    currencyBreakdown = [
      {
        currency,
        companies: 1,
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses
      }
    ];
  }

  return {
    overview: {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      salesRevenue: totalSalesRevenue,
      invoicesCount: invoiceCount,
      salesCount,
      transactionsCount: totalTransactions,
      activeBranchesCount,
      companiesCount,
      activeCompaniesCount,
      usersCount,
      activeUsersCount,
      usageWindowDays,
      currency,
      mixedCurrencies: !companyId,
      companyName: companyMeta?.name || null,
      range: trendPeriod
    },
    branchPerformance: branchRankExtended,
    employeePerformance: employeeLeaderboard,
    productInsights: bestProducts.map((row) => ({ productId: row._id, name: row.productName || "Unknown", quantity: row.quantity, revenue: row.revenue })),
    topCompanies,
    currencyBreakdown,
    timeseries,
    alerts: [],
    raw: {
      branchTrend: branchRank,
      productTrend: bestProducts
    }
  };
}

async function getSuperAdminAlerts({ companyId, fromDate, toDate } = {}) {
  const overview = await getSuperAdminOverview({ companyId, fromDate, toDate, groupBy: "month" });

  const suddenDrop = (() => {
    const len = overview.timeseries.length;
    if (len < 2) return null;
    const lastPeriod = overview.timeseries[len - 1];
    const prevPeriod = overview.timeseries[len - 2];
    if (prevPeriod.revenue <= 0) return null;
    const drop = ((prevPeriod.revenue - lastPeriod.revenue) / prevPeriod.revenue) * 100;
    if (drop >= 20) return { type: "sudden_drop_in_revenue", drop: Number(drop.toFixed(1)), previous: prevPeriod.revenue, current: lastPeriod.revenue };
    return null;
  })();

  const highInvoice = await Invoice.find({ ...(companyId ? { companyId } : {}), status: { $ne: "cancelled" }, issueDate: { $gte: fromDate || new Date(0), $lte: toDate || new Date() } })
    .sort({ total: -1 })
    .limit(3)
    .select("invoiceNo total issueDate branchId branchName salespersonId")
    .lean();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activeBranchIds = await Invoice.distinct("branchId", { ...(companyId ? { companyId } : {}), issueDate: { $gte: thirtyDaysAgo } });
  const inactiveBranches = await Branch.find({ ...(companyId ? { companyId } : {}), isActive: true, _id: { $nin: activeBranchIds } }).select("name code").lean();

  const alerts = [];
  if (suddenDrop) alerts.push(suddenDrop);
  if (highInvoice?.length) alerts.push({ type: "high_invoice", invoices: highInvoice });
  if (inactiveBranches.length) alerts.push({ type: "inactive_branches", branches: inactiveBranches });

  return alerts;
}

async function getSuperAdminIncomeStatement({ companyId, fromDate, toDate, groupBy = "month" } = {}) {
  const invoiceMatch = { status: { $nin: ["cancelled"] } };
  if (companyId) invoiceMatch.companyId = companyId;
  if (fromDate || toDate) {
    invoiceMatch.issueDate = {};
    if (fromDate) invoiceMatch.issueDate.$gte = fromDate;
    if (toDate) invoiceMatch.issueDate.$lte = toDate;
  }

  const expenseMatch = {};
  if (companyId) expenseMatch.companyId = companyId;
  if (fromDate || toDate) {
    expenseMatch.date = {};
    if (fromDate) expenseMatch.date.$gte = fromDate;
    if (toDate) expenseMatch.date.$lte = toDate;
  }

  const [
    revenueAgg,
    expenseAgg,
    revenueSeries,
    expenseSeries
  ] = await Promise.all([
    Invoice.aggregate([{ $match: invoiceMatch }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $group: { _id: toSeriesKeyExpression(groupBy, "issueDate"), revenue: { $sum: "$total" } } },
      { $sort: { _id: 1 } }
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
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
      revenueByInvoice: [], // Too many for super admin
      expensesByCategory: [] // Could add if needed
    },
    series
  };
}

module.exports = {
  getSuperAdminOverview,
  getSuperAdminAlerts,
  getSuperAdminIncomeStatement
};
