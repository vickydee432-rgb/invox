const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { parseOptionalDate, handleRouteError } = require("./_helpers");
const Invoice = require("../models/Invoice");
const Quote = require("../models/Quote");
const Expense = require("../models/Expense");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Company = require("../models/Company");
const { buildReportsWorkbook } = require("../services/export");
const { generateReportsPdf } = require("../services/reportPdf");

const router = express.Router();
router.use(requireAuth, requireSubscription);

async function buildReportData(req) {
  const company = await Company.findById(req.user.companyId).lean();
  const businessType = company?.businessType || "construction";
  const fromDate = parseOptionalDate(req.query.from, "from");
  const toDate = parseOptionalDate(req.query.to, "to");

  const invoiceMatch = { companyId: req.user.companyId };
  const quoteMatch = { companyId: req.user.companyId };
  const expenseMatch = { companyId: req.user.companyId };

  if (fromDate || toDate) {
    invoiceMatch.issueDate = {};
    quoteMatch.issueDate = {};
    expenseMatch.date = {};

    if (fromDate) {
      invoiceMatch.issueDate.$gte = fromDate;
      quoteMatch.issueDate.$gte = fromDate;
      expenseMatch.date.$gte = fromDate;
    }
    if (toDate) {
      invoiceMatch.issueDate.$lte = toDate;
      quoteMatch.issueDate.$lte = toDate;
      expenseMatch.date.$lte = toDate;
    }
  }

  const [quoteAgg, invoiceAgg, expenseAgg, overdueCount, billedPaidByMonth, expensesByMonth] =
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

  const seriesMap = new Map();
  billedPaidByMonth.forEach((row) => {
    seriesMap.set(row._id, {
      month: row._id,
      billed: row.billed || 0,
      paid: row.paid || 0,
      expenses: 0
    });
  });
  expensesByMonth.forEach((row) => {
    const existing = seriesMap.get(row._id) || {
      month: row._id,
      billed: 0,
      paid: 0,
      expenses: 0
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
        Invoice.aggregate([
          { $match: { companyId: req.user.companyId, invoiceType: "sale", issueDate: { $gte: start, $lt: end } } },
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

module.exports = router;
