const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { parseOptionalDate, handleRouteError, ensureObjectId } = require("./_helpers");
const Invoice = require("../models/Invoice");
const Sale = require("../models/Sale");
const Quote = require("../models/Quote");
const Expense = require("../models/Expense");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Company = require("../models/Company");
const Account = require("../models/Account");
const Journal = require("../models/Journal");
const JournalLine = require("../models/JournalLine");
const { buildReportsWorkbook } = require("../services/export");
const { generateReportsPdf } = require("../services/reportPdf");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("reports"));

async function buildReportData(req) {
  const company = await Company.findById(req.user.companyId).lean();
  const businessType = company?.businessType || "construction";
  const fromDate = parseOptionalDate(req.query.from, "from");
  const toDate = parseOptionalDate(req.query.to, "to");

  const invoiceMatch = { companyId: req.user.companyId };
  const quoteMatch = { companyId: req.user.companyId };
  const expenseMatch = { companyId: req.user.companyId };
  const salesMatch = { companyId: req.user.companyId, deletedAt: null };

  if (fromDate || toDate) {
    invoiceMatch.issueDate = {};
    quoteMatch.issueDate = {};
    expenseMatch.date = {};
    salesMatch.issueDate = {};

    if (fromDate) {
      invoiceMatch.issueDate.$gte = fromDate;
      quoteMatch.issueDate.$gte = fromDate;
      expenseMatch.date.$gte = fromDate;
      salesMatch.issueDate.$gte = fromDate;
    }
    if (toDate) {
      invoiceMatch.issueDate.$lte = toDate;
      quoteMatch.issueDate.$lte = toDate;
      expenseMatch.date.$lte = toDate;
      salesMatch.issueDate.$lte = toDate;
    }
  }

  const [
    quoteAgg,
    invoiceAgg,
    expenseAgg,
    salesAgg,
    overdueCount,
    billedPaidByMonth,
    salesByMonth,
    expensesByMonth
  ] =
    await Promise.all([
      Quote.aggregate([
        { $match: quoteMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$total" }
          }
        }
      ]),
      Invoice.aggregate([
        { $match: invoiceMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            billed: { $sum: "$total" },
            paid: { $sum: "$amountPaid" },
            outstanding: { $sum: "$balance" }
          }
        }
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$amount" }
          }
        }
      ]),
      Sale.aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$total" },
            paid: { $sum: "$amountPaid" },
            outstanding: { $sum: "$balance" }
          }
        }
      ]),
      Invoice.countDocuments({
        ...invoiceMatch,
        balance: { $gt: 0 },
        dueDate: { $lt: new Date() }
      }),
      Invoice.aggregate([
        { $match: invoiceMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$issueDate" } },
            billed: { $sum: "$total" },
            paid: { $sum: "$amountPaid" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Sale.aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$issueDate" } },
            sales: { $sum: "$total" },
            salesPaid: { $sum: "$amountPaid" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
            expenses: { $sum: "$amount" }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

  const quoteTotals = quoteAgg[0] || { count: 0, total: 0 };
  const invoiceTotals = invoiceAgg[0] || { count: 0, billed: 0, paid: 0, outstanding: 0 };
  const expenseTotals = expenseAgg[0] || { count: 0, total: 0 };
  const salesTotals = salesAgg[0] || { count: 0, total: 0, paid: 0, outstanding: 0 };

  const seriesMap = new Map();
  billedPaidByMonth.forEach((row) => {
    seriesMap.set(row._id, {
      month: row._id,
      billed: row.billed || 0,
      paid: row.paid || 0,
      expenses: 0,
      sales: 0,
      salesPaid: 0
    });
  });
  salesByMonth.forEach((row) => {
    const existing = seriesMap.get(row._id) || {
      month: row._id,
      billed: 0,
      paid: 0,
      expenses: 0,
      sales: 0,
      salesPaid: 0
    };
    existing.sales = row.sales || 0;
    existing.salesPaid = row.salesPaid || 0;
    seriesMap.set(row._id, existing);
  });
  expensesByMonth.forEach((row) => {
    const existing = seriesMap.get(row._id) || {
      month: row._id,
      billed: 0,
      paid: 0,
      expenses: 0,
      sales: 0,
      salesPaid: 0
    };
    existing.expenses = row.expenses || 0;
    seriesMap.set(row._id, existing);
  });

  const series = Array.from(seriesMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  let retail = null;
  if (businessType === "retail") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [salesTodayAgg, expensesTodayAgg, cogsAgg, stockValueAgg, lowStockAgg] =
      await Promise.all([
        Sale.aggregate([
          { $match: { companyId: req.user.companyId, issueDate: { $gte: start, $lt: end }, deletedAt: null } },
          { $group: { _id: null, total: { $sum: "$total" } } }
        ]),
        Expense.aggregate([
          { $match: { companyId: req.user.companyId, date: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        StockMovement.aggregate([
          { $match: { companyId: req.user.companyId, type: "sale", createdAt: { $gte: start, $lt: end } } },
          { $group: { _id: null, totalCost: { $sum: "$totalCost" } } }
        ]),
        Stock.aggregate([
          { $match: { companyId: req.user.companyId } },
          { $group: { _id: null, value: { $sum: { $multiply: ["$onHand", "$avgCost"] } } } }
        ]),
        Stock.aggregate([
          { $match: { companyId: req.user.companyId } },
          {
            $lookup: {
              from: Product.collection.name,
              localField: "productId",
              foreignField: "_id",
              as: "product"
            }
          },
          { $unwind: "$product" },
          {
            $match: {
              $expr: {
                $and: [
                  { $gt: ["$product.reorderLevel", 0] },
                  { $lte: ["$onHand", "$product.reorderLevel"] }
                ]
              }
            }
          },
          { $count: "count" }
        ])
      ]);

    const salesToday = salesTodayAgg[0]?.total || 0;
    const expensesToday = expensesTodayAgg[0]?.total || 0;
    const cogsToday = cogsAgg[0]?.totalCost || 0;
    const stockValue = stockValueAgg[0]?.value || 0;
    const lowStockCount = lowStockAgg[0]?.count || 0;

    retail = {
      sales_today: salesToday,
      expenses_today: expensesToday,
      profit_today: salesToday - expensesToday - cogsToday,
      stock_value: stockValue,
      low_stock_count: lowStockCount
    };
  }

  return {
    range: {
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate ? toDate.toISOString() : null
    },
    summary: {
      quotes_count: quoteTotals.count,
      quotes_total: quoteTotals.total,
      sales_count: salesTotals.count,
      sales_total: salesTotals.total,
      sales_paid_total: salesTotals.paid,
      sales_outstanding: salesTotals.outstanding,
      invoices_count: invoiceTotals.count,
      invoices_billed_total: invoiceTotals.billed,
      invoices_paid_total: invoiceTotals.paid,
      invoices_outstanding: invoiceTotals.outstanding,
      expenses_count: expenseTotals.count,
      expenses_total: expenseTotals.total,
      profit_on_paid: invoiceTotals.paid - expenseTotals.total,
      profit_on_billed: invoiceTotals.billed - expenseTotals.total,
      overdue_count: overdueCount
    },
    series,
    businessType,
    retail
  };
}

router.get("/overview", async (req, res) => {
  try {
    const data = await buildReportData(req);
    res.json(data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to load reports");
  }
});

router.get("/export.xlsx", async (req, res) => {
  try {
    const data = await buildReportData(req);
    const workbook = buildReportsWorkbook(data.summary, data.series);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="reports.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export reports");
  }
});

router.get("/export.pdf", async (req, res) => {
  try {
    const data = await buildReportData(req);
    return generateReportsPdf(res, data);
  } catch (err) {
    return handleRouteError(res, err, "Failed to export reports");
  }
});

function buildDateMatch(fromDate, toDate) {
  if (!fromDate && !toDate) return {};
  const range = {};
  if (fromDate) range.$gte = fromDate;
  if (toDate) range.$lte = toDate;
  return { date: range };
}

router.get("/income-statement", async (req, res) => {
  try {
    const fromDate = parseOptionalDate(req.query.from, "from");
    const toDate = parseOptionalDate(req.query.to, "to");
    const accounts = await Account.find({
      companyId: req.user.companyId,
      type: { $in: ["Income", "Expense"] }
    })
      .select("_id name type")
      .lean();
    const accountIds = accounts.map((acc) => acc._id);
    const journalMatch = { companyId: req.user.companyId, ...buildDateMatch(fromDate, toDate) };
    const journals = await Journal.find(journalMatch).select("_id").lean();
    const journalIds = journals.map((j) => j._id);
    const rows = await JournalLine.aggregate([
      { $match: { companyId: req.user.companyId, journalId: { $in: journalIds }, accountId: { $in: accountIds } } },
      {
        $group: {
          _id: "$accountId",
          debit: { $sum: "$debit" },
          credit: { $sum: "$credit" }
        }
      }
    ]);
    const map = new Map(rows.map((row) => [String(row._id), row]));
    const formatted = accounts.map((acc) => {
      const row = map.get(String(acc._id)) || { debit: 0, credit: 0 };
      const balance = acc.type === "Income" ? row.credit - row.debit : row.debit - row.credit;
      return { accountId: acc._id, name: acc.name, type: acc.type, balance };
    });
    const totalIncome = formatted.filter((r) => r.type === "Income").reduce((sum, r) => sum + r.balance, 0);
    const totalExpense = formatted.filter((r) => r.type === "Expense").reduce((sum, r) => sum + r.balance, 0);
    res.json({ from: fromDate, to: toDate, totalIncome, totalExpense, netProfit: totalIncome - totalExpense, rows: formatted });
  } catch (err) {
    return handleRouteError(res, err, "Failed to build income statement");
  }
});

router.get("/balance-sheet", async (req, res) => {
  try {
    const asAt = parseOptionalDate(req.query.asAt, "asAt") || new Date();
    const accounts = await Account.find({
      companyId: req.user.companyId,
      type: { $in: ["Asset", "Liability", "Equity"] }
    })
      .select("_id name type")
      .lean();
    const accountIds = accounts.map((acc) => acc._id);
    const journals = await Journal.find({ companyId: req.user.companyId, date: { $lte: asAt } }).select("_id").lean();
    const journalIds = journals.map((j) => j._id);
    const rows = await JournalLine.aggregate([
      { $match: { companyId: req.user.companyId, journalId: { $in: journalIds }, accountId: { $in: accountIds } } },
      {
        $group: {
          _id: "$accountId",
          debit: { $sum: "$debit" },
          credit: { $sum: "$credit" }
        }
      }
    ]);
    const map = new Map(rows.map((row) => [String(row._id), row]));
    const formatted = accounts.map((acc) => {
      const row = map.get(String(acc._id)) || { debit: 0, credit: 0 };
      const balance = acc.type === "Asset" ? row.debit - row.credit : row.credit - row.debit;
      return { accountId: acc._id, name: acc.name, type: acc.type, balance };
    });
    res.json({ asAt, rows: formatted });
  } catch (err) {
    return handleRouteError(res, err, "Failed to build balance sheet");
  }
});

router.get("/cash-flow", async (req, res) => {
  try {
    const fromDate = parseOptionalDate(req.query.from, "from");
    const toDate = parseOptionalDate(req.query.to, "to");
    const company = await Company.findById(req.user.companyId).lean();
    const cashAccountId = company?.accountingDefaults?.cash || null;
    const bankAccountId = company?.accountingDefaults?.bank || null;
    const ids = [cashAccountId, bankAccountId].filter(Boolean);
    if (ids.length === 0) return res.json({ from: fromDate, to: toDate, netCash: 0 });
    const journals = await Journal.find({ companyId: req.user.companyId, ...buildDateMatch(fromDate, toDate) })
      .select("_id")
      .lean();
    const journalIds = journals.map((j) => j._id);
    const rows = await JournalLine.aggregate([
      { $match: { companyId: req.user.companyId, journalId: { $in: journalIds }, accountId: { $in: ids } } },
      { $group: { _id: null, debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } }
    ]);
    const row = rows[0] || { debit: 0, credit: 0 };
    res.json({ from: fromDate, to: toDate, netCash: row.debit - row.credit });
  } catch (err) {
    return handleRouteError(res, err, "Failed to build cash flow");
  }
});

router.get("/trial-balance", async (req, res) => {
  try {
    const { periodId } = req.query;
    const match = { companyId: req.user.companyId };
    if (periodId) {
      ensureObjectId(String(periodId), "period id");
      const journals = await Journal.find({ companyId: req.user.companyId, periodId }).select("_id").lean();
      const journalIds = journals.map((j) => j._id);
      match.journalId = { $in: journalIds };
    }
    const rows = await JournalLine.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$accountId",
          debit: { $sum: "$debit" },
          credit: { $sum: "$credit" }
        }
      }
    ]);
    res.json({ rows });
  } catch (err) {
    return handleRouteError(res, err, "Failed to build trial balance");
  }
});

router.get("/general-ledger", async (req, res) => {
  try {
    const { accountId } = req.query;
    ensureObjectId(String(accountId), "account id");
    const lines = await JournalLine.find({ companyId: req.user.companyId, accountId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ lines });
  } catch (err) {
    return handleRouteError(res, err, "Failed to build general ledger");
  }
});

module.exports = router;
