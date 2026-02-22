const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const Quote = require("../models/Quote");
const Invoice = require("../models/Invoice");
const { makePublicQuoteToken, verifyPublicQuoteToken } = require("../services/quotePublicLink");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { generateQuotePdf } = require("../services/pdf");
const Company = require("../models/Company");
const { buildQuotesWorkbook } = require("../services/export");
const {
  nextNumber,
  buildItems,
  calcTotals,
  parseDateOrThrow,
  parseOptionalDate,
  parseLimit,
  parsePage,
  ensureObjectId,
  handleRouteError
} = require("./_helpers");

const router = express.Router();

const jwtErrorNames = new Set(["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"]);
const isJwtError = (err) => jwtErrorNames.has(err?.name);

router.use((req, res, next) => {
  if (req.path.startsWith("/public/")) return next();
  return requireAuth(req, res, (err) => {
    if (err) return next(err);
    return requireSubscription(req, res, (subErr) => {
      if (subErr) return next(subErr);
      return requireModule("quotes")(req, res, next);
    });
  });
});

const QuoteCreateSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  projectId: z.string().optional(),
  projectLabel: z.string().optional(),
  issueDate: z.string().optional(),
  validUntil: z.string().min(1),
  vatRate: z.number().optional().default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(
    z.object({
      description: z.string().min(1),
      qty: z.number().nonnegative(),
      unitPrice: z.number().nonnegative(),
      discount: z.number().nonnegative().optional()
    })
  ).min(1)
});

const QuoteUpdateSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().optional(),
  projectId: z.string().optional(),
  projectLabel: z.string().optional(),
  issueDate: z.string().optional(),
  validUntil: z.string().optional(),
  vatRate: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(
    z.object({
      description: z.string().min(1),
      qty: z.number().nonnegative(),
      unitPrice: z.number().nonnegative(),
      discount: z.number().nonnegative().optional()
    })
  ).min(1).optional()
});

function buildQuoteFilter(query) {
  const { status, projectId, from, to, q } = query;
  const filter = {};
  if (status) filter.status = status;
  if (projectId) {
    ensureObjectId(projectId, "project id");
    filter.projectId = projectId;
  }
  if (q) filter.customerName = { $regex: String(q), $options: "i" };
  if (from || to) {
    filter.issueDate = {};
    const fromDate = parseOptionalDate(from, "from");
    const toDate = parseOptionalDate(to, "to");
    if (fromDate) filter.issueDate.$gte = fromDate;
    if (toDate) filter.issueDate.$lte = toDate;
  }
  return filter;
}

// List quotes with optional filters: status, projectId, from, to, q (customerName)
router.get("/", async (req, res) => {
  try {
    const { limit, page } = req.query;
    const filter = { ...buildQuoteFilter(req.query), companyId: req.user.companyId };

    const safeLimit = parseLimit(limit, { defaultLimit: 200, maxLimit: 500 });
    const pageNum = parsePage(page);
    const total = await Quote.countDocuments(filter);
    const skip = (pageNum - 1) * safeLimit;
    const quotes = await Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: quotes.length, quotes });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list quotes");
  }
});

// Export quotes to Excel
router.get("/export.xlsx", async (req, res) => {
  try {
    const { limit } = req.query;
    const filter = { ...buildQuoteFilter(req.query), companyId: req.user.companyId };
    const safeLimit = parseLimit(limit, { defaultLimit: 2000, maxLimit: 5000 });
    const quotes = await Quote.find(filter).sort({ createdAt: -1 }).limit(safeLimit).lean();
    const workbook = buildQuotesWorkbook(quotes);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="quotes.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export quotes");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "quote id");
    const quote = await Quote.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    res.json({ quote });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get quote");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "quote id");
    const quote = await Quote.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete quote");
  }
});

// Download quote PDF
router.get("/:id/pdf", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "quote id");
    const quote = await Quote.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    const company = await Company.findById(quote.companyId).lean();
    return generateQuotePdf(res, quote, company);
  } catch (err) {
    return handleRouteError(res, err, "Failed to generate quote PDF");
  }
});

// Update quote (draft/sent)
router.put("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "quote id");
    const parsed = QuoteUpdateSchema.parse(req.body);
    const quote = await Quote.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    if (!["draft", "sent"].includes(quote.status)) {
      return res.status(400).json({ error: `Cannot edit quote in status: ${quote.status}` });
    }

    if (parsed.projectId !== undefined && parsed.projectId) {
      ensureObjectId(parsed.projectId, "project id");
    }

    if (parsed.customerName !== undefined) quote.customerName = parsed.customerName;
    if (parsed.customerPhone !== undefined) quote.customerPhone = parsed.customerPhone;
    if (parsed.projectId !== undefined) quote.projectId = parsed.projectId || null;
    if (parsed.projectLabel !== undefined) quote.projectLabel = parsed.projectLabel;
    if (parsed.issueDate !== undefined) {
      quote.issueDate = parseOptionalDate(parsed.issueDate, "issueDate") || quote.issueDate;
    }
    if (parsed.validUntil !== undefined) quote.validUntil = parseDateOrThrow(parsed.validUntil, "validUntil");
    if (parsed.notes !== undefined) quote.notes = parsed.notes;
    if (parsed.terms !== undefined) quote.terms = parsed.terms;

    const shouldRecalc = parsed.items !== undefined || parsed.vatRate !== undefined;
    if (parsed.items !== undefined) {
      quote.items = buildItems(parsed.items);
    }
    if (parsed.vatRate !== undefined) {
      quote.vatRate = parsed.vatRate;
    }
    if (shouldRecalc) {
      const { subtotal, vatAmount, total } = calcTotals(quote.items, quote.vatRate);
      quote.subtotal = subtotal;
      quote.vatAmount = vatAmount;
      quote.total = total;
    }

    await quote.save();
    res.json({ quote });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update quote");
  }
});

// 1) Create quote
router.post("/", async (req, res) => {
  try {
    const parsed = QuoteCreateSchema.parse(req.body);

    const quoteNo = await nextNumber("Q", Quote, "quoteNo", "^Q-");
    const items = buildItems(parsed.items);
    const vatRate = parsed.vatRate ?? 0;
    const { subtotal, vatAmount, total } = calcTotals(items, vatRate);
    const issueDate = parseOptionalDate(parsed.issueDate, "issueDate") || new Date();
    const validUntil = parseDateOrThrow(parsed.validUntil, "validUntil");

    const quote = await Quote.create({
      quoteNo,
      companyId: req.user.companyId,
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone,
      projectId: parsed.projectId || null,
      projectLabel: parsed.projectLabel,
      issueDate,
      validUntil,
      vatRate,
      items,
      subtotal,
      vatAmount,
      total,
      notes: parsed.notes,
      terms: parsed.terms,
      status: "draft"
    });

    res.status(201).json(quote);
  } catch (err) {
    return handleRouteError(res, err, "Failed to create quote");
  }
});

// 2) Send quote + public link
router.post("/:id/send", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "quote id");
    const quote = await Quote.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    if (quote.validUntil.getTime() < Date.now()) {
      quote.status = "expired";
      await quote.save();
      return res.status(400).json({ error: "Quote already expired" });
    }

    quote.status = "sent";
    await quote.save();

    const token = makePublicQuoteToken({ quoteId: quote._id.toString(), validUntil: quote.validUntil });
    const publicUrl = `/api/quotes/public/${token}`;
    const appBase = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    const publicAppUrl = `${appBase.replace(/\/$/, "")}/quote/${token}`;

    res.json({ quote, publicUrl, publicAppUrl });
  } catch (err) {
    return handleRouteError(res, err, "Failed to send quote");
  }
});

// 3) Public view
router.get("/public/:token", async (req, res) => {
  try {
    const { quoteId } = verifyPublicQuoteToken(req.params.token);
    ensureObjectId(quoteId, "quote id");
    const quote = await Quote.findById(quoteId).lean();
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    const company = await Company.findById(quote.companyId).lean();

    const now = Date.now();
    if (new Date(quote.validUntil).getTime() < now && quote.status !== "accepted") {
      await Quote.updateOne({ _id: quoteId, status: { $in: ["draft", "sent"] } }, { $set: { status: "expired" } });
      quote.status = "expired";
    }

    res.json({ quote, company });
  } catch (err) {
    if (isJwtError(err)) return res.status(401).json({ error: "Invalid or expired link" });
    return handleRouteError(res, err, "Failed to load quote");
  }
});

// 4) Accept quote -> auto-create invoice (transaction)
router.post("/public/:token/accept", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { quoteId } = verifyPublicQuoteToken(req.params.token);
    ensureObjectId(quoteId, "quote id");

    await session.withTransaction(async () => {
      const quote = await Quote.findById(quoteId).session(session);
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      if (quote.convertedInvoiceId) {
        const existing = await Invoice.findById(quote.convertedInvoiceId).session(session);
        return res.json({ quote, invoice: existing, note: "Invoice already created" });
      }

      if (quote.validUntil.getTime() < Date.now()) {
        quote.status = "expired";
        await quote.save({ session });
        return res.status(400).json({ error: "Quote expired" });
      }

      if (!["sent", "draft"].includes(quote.status)) {
        return res.status(400).json({ error: `Cannot accept quote in status: ${quote.status}` });
      }

      const invoiceNo = await nextNumber("INV", Invoice, "invoiceNo", "^INV-");

      const dueDays = Number(process.env.DEFAULT_INVOICE_DUE_DAYS || 7);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      const invoice = await Invoice.create(
        [
          {
            invoiceNo,
            companyId: quote.companyId,
            customerName: quote.customerName,
            customerPhone: quote.customerPhone,
            projectId: quote.projectId,
            projectLabel: quote.projectLabel,
            status: "sent",
            issueDate: new Date(),
            dueDate,
            items: quote.items,
            subtotal: quote.subtotal,
            vatRate: quote.vatRate,
            vatAmount: quote.vatAmount,
            total: quote.total,
            amountPaid: 0,
            balance: quote.total,
            sourceQuoteId: quote._id
          }
        ],
        { session }
      );

      quote.status = "accepted";
      quote.convertedInvoiceId = invoice[0]._id;
      await quote.save({ session });

      res.json({ quote, invoice: invoice[0] });
    });
  } catch (err) {
    if (isJwtError(err)) return res.status(401).json({ error: "Invalid or expired link" });
    return handleRouteError(res, err, "Failed to accept quote");
  } finally {
    session.endSession();
  }
});

// 5) Decline
router.post("/public/:token/decline", async (req, res) => {
  try {
    const { quoteId } = verifyPublicQuoteToken(req.params.token);
    ensureObjectId(quoteId, "quote id");
    const quote = await Quote.findById(quoteId);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    if (quote.validUntil.getTime() < Date.now() && quote.status !== "accepted") {
      quote.status = "expired";
      await quote.save();
      return res.status(400).json({ error: "Quote expired" });
    }

    if (!["sent", "draft"].includes(quote.status)) {
      return res.status(400).json({ error: `Cannot decline quote in status: ${quote.status}` });
    }

    quote.status = "declined";
    await quote.save();
    res.json({ quote });
  } catch (err) {
    if (isJwtError(err)) return res.status(401).json({ error: "Invalid or expired link" });
    return handleRouteError(res, err, "Failed to decline quote");
  }
});

module.exports = router;
