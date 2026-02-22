const express = require("express");
const { z } = require("zod");
const Invoice = require("../models/Invoice");
const {
  ensureObjectId,
  nextNumber,
  parseOptionalDate,
  parseDateOrThrow,
  parseLimit,
  parsePage,
  buildItems,
  calcTotals,
  handleRouteError
} = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule, requireTaxEnabled } = require("../middleware/workspace");
const { generateInvoicePdf } = require("../services/pdf");
const { buildInvoicesWorkbook } = require("../services/export");
const Company = require("../models/Company");
const ExcelJS = require("exceljs");
const ZraConnection = require("../models/ZraConnection");
const Branch = require("../models/Branch");
const Product = require("../models/Product");
const { submitInvoice, submitCancel, submitCreditNote } = require("../services/zra/client");
const {
  buildZraInvoicePayload,
  buildZraCancelPayload,
  buildZraCreditPayload
} = require("../services/zra/transform");
const { mapZraStatus } = require("../services/zra/mapping");
const { applyInvoiceInventory, replaceInvoiceMovements } = require("../services/inventory");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("invoices"));

function buildInvoiceFilter(query) {
  const { status, projectId, from, to, q, source } = query;
  const filter = {};
  if (status) filter.status = status;
  if (source) filter.source = source;
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

async function resolveBranch(companyId, branchId) {
  if (!branchId) return null;
  ensureObjectId(branchId, "branch id");
  const branch = await Branch.findOne({ _id: branchId, companyId, isActive: true }).lean();
  if (!branch) {
    const err = new Error("Branch not found");
    err.status = 400;
    throw err;
  }
  return branch;
}

async function hydrateProductFields(companyId, items) {
  const productIds = items
    .map((item) => item.productId)
    .filter(Boolean)
    .map((id) => {
      ensureObjectId(id, "product id");
      return id;
    });
  if (productIds.length === 0) return items;

  const products = await Product.find({ _id: { $in: productIds }, companyId }).lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return items.map((item) => {
    if (!item.productId) return item;
    const product = productMap.get(String(item.productId));
    if (!product) {
      const err = new Error("Product not found");
      err.status = 400;
      throw err;
    }
    return {
      ...item,
      productSku: product.sku || item.productSku,
      productName: product.name || item.productName
    };
  });
}

function requiresBranch(items) {
  return items.some((item) => Boolean(item.productId));
}

// List invoices with optional filters: status, projectId, from, to, q (customerName)
router.get("/", async (req, res) => {
  try {
    const { limit, page } = req.query;
    const filter = { ...buildInvoiceFilter(req.query), companyId: req.user.companyId };

    const safeLimit = parseLimit(limit, { defaultLimit: 200, maxLimit: 500 });
    const pageNum = parsePage(page);
    const total = await Invoice.countDocuments(filter);
    const skip = (pageNum - 1) * safeLimit;
    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: invoices.length, invoices });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list invoices");
  }
});

// Export invoices to Excel
router.get("/export.xlsx", async (req, res) => {
  try {
    const { limit } = req.query;
    const filter = { ...buildInvoiceFilter(req.query), companyId: req.user.companyId };
    const safeLimit = parseLimit(limit, { defaultLimit: 2000, maxLimit: 5000 });
    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(safeLimit).lean();
    const workbook = buildInvoicesWorkbook(invoices);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="invoices.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export invoices");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "invoice id");
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json({ invoice });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get invoice");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "invoice id");
    const session = await Invoice.startSession();
    session.startTransaction();
    try {
      const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId }).session(
        session
      );
      if (!invoice) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Invoice not found" });
      }
      const clearedInvoice = { ...invoice.toObject(), items: [] };
      const inventoryResult = await applyInvoiceInventory({
        companyId: req.user.companyId,
        invoice: clearedInvoice,
        previousInvoice: invoice,
        session
      });
      if (inventoryResult.shortages.length > 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          error: "Insufficient stock to delete this invoice",
          shortages: inventoryResult.shortages
        });
      }
      await replaceInvoiceMovements({ companyId: req.user.companyId, invoice: clearedInvoice, session });
      await invoice.deleteOne({ session });
      await session.commitTransaction();
      session.endSession();
      res.json({ ok: true });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete invoice");
  }
});

// Download invoice PDF
router.get("/:id/pdf", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "invoice id");
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const company = await Company.findById(invoice.companyId).lean();
    return generateInvoicePdf(res, invoice, company);
  } catch (err) {
    return handleRouteError(res, err, "Failed to generate invoice PDF");
  }
});

const InvoiceImportSchema = z.object({
  base64: z.string().min(1),
  defaultStatus: z.enum(["draft", "sent", "paid"]).optional(),
  dueDatePreference: z.enum(["dueDate", "date", "auto"]).optional()
});

function normalizeCellText(cell) {
  if (!cell) return "";
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value.text) return String(value.text).trim();
    if (value.richText) return value.richText.map((part) => part.text).join("").trim();
    if (value.formula) return value.result !== undefined ? String(value.result).trim() : "";
    if (value.hyperlink) return String(value.text || value.hyperlink).trim();
  }
  return String(value).trim();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return value;
  const normalized = String(value).replace(/[,]/g, "").replace(/[^\d.-]/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : NaN;
}

function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const slash = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    // Prefer day-first; swap if month looks invalid
    let day = a;
    let month = b;
    if (month > 12 && day <= 12) {
      day = b;
      month = a;
    }
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

router.post("/import", async (req, res) => {
  try {
    const parsed = InvoiceImportSchema.parse(req.body);
    const base64 = parsed.base64.includes(",") ? parsed.base64.split(",").pop() : parsed.base64;
    const buffer = Buffer.from(base64, "base64");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ error: "No worksheet found" });

    const headerRow = sheet.getRow(1);
    const headerMap = {};
    headerRow.eachCell((cell, colNumber) => {
      const raw = normalizeCellText(cell).toLowerCase();
      if (!raw) return;
      if (raw.includes("invoice") && raw.includes("no")) headerMap.invoiceNo = colNumber;
      else if (raw.includes("invoice number")) headerMap.invoiceNo = colNumber;
      else if (raw.includes("customer") && raw.includes("name")) headerMap.customerName = colNumber;
      else if (raw === "customer") headerMap.customerName = colNumber;
      else if (raw.includes("phone")) headerMap.customerPhone = colNumber;
      else if (raw.includes("tpin")) headerMap.customerTpin = colNumber;
      else if (raw.includes("due") && raw.includes("date")) headerMap.dueDate = colNumber;
      else if (raw.includes("issue") && raw.includes("date")) headerMap.date = colNumber;
      else if (raw === "date") headerMap.date = colNumber;
      else if (raw.includes("status")) headerMap.status = colNumber;
      else if (
        raw.includes("vat rate") ||
        raw.includes("tax rate") ||
        raw.includes("tax category") ||
        (raw.includes("vat") && !raw.includes("amount"))
      )
        headerMap.vatRate = colNumber;
      else if (
        raw.includes("description") ||
        raw.includes("item") ||
        raw.includes("service name") ||
        raw.includes("service")
      )
        headerMap.description = colNumber;
      else if (raw.includes("qty") || raw.includes("quantity")) headerMap.qty = colNumber;
      else if (raw.includes("unit") || raw.includes("unit supply price") || raw.includes("price"))
        headerMap.unitPrice = colNumber;
      else if (raw.includes("taxable supply amount") || raw.includes("taxable amount"))
        headerMap.taxableAmount = colNumber;
      else if (raw.includes("discount")) headerMap.discount = colNumber;
    });

    const required = ["customerName", "description", "qty", "unitPrice"];
    const missing = required.filter((key) => headerMap[key] === undefined);
    const hasAnyDate = headerMap.dueDate !== undefined || headerMap.date !== undefined;
    if (missing.length > 0 || !hasAnyDate) {
      const missingList = [...missing];
      if (!hasAnyDate) missingList.push("Due Date or Date");
      return res.status(400).json({ error: `Missing columns: ${missingList.join(", ")}` });
    }

    const rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push(row);
    });

    const errors = [];
    const groups = new Map();

    const dueDatePreference = parsed.dueDatePreference || "auto";
    rows.forEach((row) => {
      const getText = (key) => normalizeCellText(row.getCell(headerMap[key]));
      const invoiceNo = headerMap.invoiceNo ? getText("invoiceNo") : "";
      const customerName = getText("customerName");
      const customerPhone = headerMap.customerPhone ? getText("customerPhone") : "";
      const customerTpin = headerMap.customerTpin ? getText("customerTpin") : "";
      const dueDateCell =
        dueDatePreference === "date"
          ? headerMap.date ?? headerMap.dueDate
          : dueDatePreference === "dueDate"
            ? headerMap.dueDate ?? headerMap.date
            : headerMap.dueDate ?? headerMap.date;
      const dueDateRaw = dueDateCell ? normalizeCellText(row.getCell(dueDateCell)) : "";
      const dueDate = dueDateCell ? parseExcelDate(row.getCell(dueDateCell).value || dueDateRaw) : null;
      const statusRaw = headerMap.status ? getText("status").toLowerCase() : "";
      const normalizedStatus =
        statusRaw === "unpaid" || statusRaw === "pending" ? "sent" : statusRaw === "partial" ? "sent" : statusRaw;
      const status = parsed.defaultStatus || normalizedStatus || "sent";
      const vatRateRaw = headerMap.vatRate ? getText("vatRate") : "";
      let vatRate = vatRateRaw ? parseNumber(vatRateRaw) : 0;
      if (!Number.isFinite(vatRate)) {
        const rawLower = vatRateRaw.toLowerCase();
        if (rawLower.includes("exempt") || rawLower.includes("zero") || rawLower.includes("zero-rated")) {
          vatRate = 0;
        }
      }
      const description = getText("description");
      const qty = parseNumber(getText("qty"));
      const unitPrice = parseNumber(getText("unitPrice"));
      const taxableRaw = headerMap.taxableAmount ? getText("taxableAmount") : "";
      const taxableAmount = taxableRaw ? parseNumber(taxableRaw) : NaN;
      const discount = headerMap.discount ? parseNumber(getText("discount")) : 0;

      const rowIndex = row.number;
      if (!customerName) return errors.push({ row: rowIndex, error: "Missing customer name" });
      if (!dueDate) return errors.push({ row: rowIndex, error: "Invalid due date" });
      if (!description) return errors.push({ row: rowIndex, error: "Missing item description" });
      if (!Number.isFinite(qty) || qty <= 0) return errors.push({ row: rowIndex, error: "Invalid quantity" });
      let normalizedUnitPrice = unitPrice;
      if (Number.isFinite(taxableAmount) && taxableAmount !== 0 && Number.isFinite(qty) && qty > 0) {
        normalizedUnitPrice = taxableAmount / qty;
      }
      if (!Number.isFinite(normalizedUnitPrice) || normalizedUnitPrice === 0) {
        return errors.push({ row: rowIndex, error: "Invalid unit price" });
      }
      if (normalizedUnitPrice < 0) {
        normalizedUnitPrice = Math.abs(normalizedUnitPrice);
      }
      if (!Number.isFinite(discount) || discount < 0)
        return errors.push({ row: rowIndex, error: "Invalid discount" });
      if (!["draft", "sent", "paid"].includes(status))
        return errors.push({ row: rowIndex, error: "Invalid status" });
      if (!Number.isFinite(vatRate) || vatRate < 0)
        return errors.push({ row: rowIndex, error: "Invalid VAT rate" });

      const groupKey = invoiceNo
        ? `no:${invoiceNo}`
        : `key:${customerName.toLowerCase()}|${dueDate.toISOString().slice(0, 10)}|${status}|${vatRate}|${customerPhone}|${customerTpin}`;

      const group = groups.get(groupKey) || {
        invoiceNo,
        customerName,
        customerPhone,
        customerTpin,
        dueDate,
        status,
        vatRate,
        items: []
      };
      group.items.push({ description, qty, unitPrice: normalizedUnitPrice, discount });
      groups.set(groupKey, group);
    });

    if (groups.size === 0) {
      return res.status(400).json({ error: "No valid rows found", errors });
    }

    const invoiceNos = Array.from(groups.values())
      .map((group) => group.invoiceNo)
      .filter(Boolean);
    const existing = invoiceNos.length
      ? await Invoice.find({ companyId: req.user.companyId, invoiceNo: { $in: invoiceNos } })
          .select("invoiceNo")
          .lean()
      : [];
    const existingSet = new Set(existing.map((row) => row.invoiceNo));

    const createPayload = [];
    for (const group of groups.values()) {
      if (group.invoiceNo && existingSet.has(group.invoiceNo)) {
        errors.push({ row: 0, error: `Invoice number already exists: ${group.invoiceNo}` });
        continue;
      }
      const items = buildItems(group.items);
      const vatRate = group.vatRate ?? 0;
      const { subtotal, vatAmount, total } = calcTotals(items, vatRate, 0, 0);
      const status = group.status || "sent";
      const amountPaid = status === "paid" ? total : 0;
      const balance = Math.max(0, total - amountPaid);
      const invoiceNo = group.invoiceNo || (await nextNumber("INV", Invoice, "invoiceNo", "^INV-"));

      createPayload.push({
        invoiceNo,
        companyId: req.user.companyId,
        customerName: group.customerName,
        customerPhone: group.customerPhone || undefined,
        customerTpin: group.customerTpin || undefined,
        billingAddress: undefined,
        shippingAddress: undefined,
        sameAsBilling: false,
        shipBy: undefined,
        trackingRef: undefined,
        shippingCost: 0,
        shippingTaxRate: 0,
        dueDate: group.dueDate,
        status,
        vatRate,
        items,
        subtotal,
        vatAmount,
        total,
        amountPaid,
        balance
      });
    }

    if (createPayload.length === 0) {
      return res.json({ createdCount: 0, errors, message: "No invoices created" });
    }

    const created = await Invoice.insertMany(createPayload);
    res.status(201).json({ createdCount: created.length, errors });
  } catch (err) {
    return handleRouteError(res, err, "Failed to import invoices");
  }
});

const InvoiceUpdateSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().optional(),
  customerTpin: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  sameAsBilling: z.boolean().optional(),
  shipBy: z.string().optional(),
  trackingRef: z.string().optional(),
  shippingCost: z.number().nonnegative().optional(),
  shippingTaxRate: z.number().nonnegative().optional(),
  projectId: z.string().optional(),
  projectLabel: z.string().optional(),
  invoiceType: z.enum(["sale", "purchase"]).optional(),
  branchId: z.string().optional(),
  dueDate: z.string().optional(),
  status: z
    .enum([
      "draft",
      "sent",
      "paid",
      "partial",
      "overdue",
      "cancelled",
      "imported_pending",
      "imported_approved",
      "imported_rejected",
      "credited"
    ])
    .optional(),
  vatRate: z.number().nonnegative().optional(),
  items: z.array(
    z.object({
      productId: z.string().optional(),
      productSku: z.string().optional(),
      productName: z.string().optional(),
      description: z.string().min(1),
      qty: z.number().nonnegative(),
      unitPrice: z.number().nonnegative(),
      discount: z.number().nonnegative().optional()
    })
  ).min(1).optional()
});

const InvoiceCreateSchema = z.object({
  invoiceNo: z.string().min(1).optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerTpin: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  sameAsBilling: z.boolean().optional(),
  shipBy: z.string().optional(),
  trackingRef: z.string().optional(),
  shippingCost: z.number().nonnegative().optional(),
  shippingTaxRate: z.number().nonnegative().optional(),
  projectId: z.string().optional(),
  projectLabel: z.string().optional(),
  invoiceType: z.enum(["sale", "purchase"]).optional(),
  branchId: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().min(1),
  status: z.enum(["draft", "sent", "paid"]).optional(),
  vatRate: z.number().nonnegative().optional(),
  items: z.array(
    z.object({
      productId: z.string().optional(),
      productSku: z.string().optional(),
      productName: z.string().optional(),
      description: z.string().min(1),
      qty: z.number().nonnegative(),
      unitPrice: z.number().nonnegative(),
      discount: z.number().nonnegative().optional()
    })
  ).min(1)
});

// Create invoice
router.post("/", async (req, res) => {
  try {
    const parsed = InvoiceCreateSchema.parse(req.body);
    if (parsed.projectId) ensureObjectId(parsed.projectId, "project id");

    let invoiceNo = parsed.invoiceNo ? parsed.invoiceNo.trim() : "";
    if (invoiceNo) {
      const existing = await Invoice.findOne({ companyId: req.user.companyId, invoiceNo }).lean();
      if (existing) return res.status(400).json({ error: "Invoice number already exists" });
    } else {
      invoiceNo = await nextNumber("INV", Invoice, "invoiceNo", "^INV-");
    }
    const hydratedItems = await hydrateProductFields(req.user.companyId, parsed.items);
    const items = buildItems(hydratedItems);
    const vatRate = parsed.vatRate ?? 0;
    const shippingCost = parsed.shippingCost ?? 0;
    const shippingTaxRate = parsed.shippingTaxRate ?? 0;
    const { subtotal, vatAmount, total } = calcTotals(items, vatRate, shippingCost, shippingTaxRate);
    const issueDate = parseOptionalDate(parsed.issueDate, "issueDate") || new Date();
    const dueDate = parseDateOrThrow(parsed.dueDate, "dueDate");

    const status = parsed.status || "sent";
    const amountPaid = status === "paid" ? total : 0;
    const balance = Math.max(0, total - amountPaid);
    const invoiceType = parsed.invoiceType || "sale";
    const branch = await resolveBranch(req.user.companyId, parsed.branchId);
    if (!branch && requiresBranch(items)) {
      return res.status(400).json({ error: "Branch is required for inventory items" });
    }

    const session = await Invoice.startSession();
    session.startTransaction();
    try {
      const invoice = new Invoice({
        invoiceNo,
        companyId: req.user.companyId,
        customerName: parsed.customerName,
        customerPhone: parsed.customerPhone,
        customerTpin: parsed.customerTpin,
        billingAddress: parsed.billingAddress,
        shippingAddress: parsed.shippingAddress,
        sameAsBilling: parsed.sameAsBilling ?? false,
        shipBy: parsed.shipBy,
        trackingRef: parsed.trackingRef,
        shippingCost,
        shippingTaxRate,
        projectId: parsed.projectId || null,
        projectLabel: parsed.projectLabel,
        invoiceType,
        branchId: branch ? branch._id : null,
        branchName: branch ? branch.name : undefined,
        issueDate,
        dueDate,
        status,
        vatRate,
        items,
        subtotal,
        vatAmount,
        total,
        amountPaid,
        balance
      });

      const inventoryResult = await applyInvoiceInventory({
        companyId: req.user.companyId,
        invoice,
        previousInvoice: null,
        session
      });
      if (inventoryResult.shortages.length > 0) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Insufficient stock for this invoice",
          shortages: inventoryResult.shortages
        });
      }

      await invoice.save({ session });
      await replaceInvoiceMovements({ companyId: req.user.companyId, invoice, session });
      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({ invoice });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    return handleRouteError(res, err, "Failed to create invoice");
  }
});

// Update invoice details (MVP)
router.put("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "invoice id");
    const parsed = InvoiceUpdateSchema.parse(req.body);
    const session = await Invoice.startSession();
    session.startTransaction();
    try {
      const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId }).session(
        session
      );
      if (!invoice) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Invoice not found" });
      }
      if (invoice.lockedAt) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "Invoice is locked after ZRA submission" });
      }
      if (["paid", "cancelled"].includes(invoice.status)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: `Cannot edit invoice in status: ${invoice.status}` });
      }

      const previousInvoice = invoice.toObject();

      if (parsed.projectId !== undefined && parsed.projectId) {
        ensureObjectId(parsed.projectId, "project id");
      }

      if (parsed.customerName !== undefined) invoice.customerName = parsed.customerName;
      if (parsed.customerPhone !== undefined) invoice.customerPhone = parsed.customerPhone;
      if (parsed.customerTpin !== undefined) invoice.customerTpin = parsed.customerTpin;
      if (parsed.billingAddress !== undefined) invoice.billingAddress = parsed.billingAddress;
      if (parsed.shippingAddress !== undefined) invoice.shippingAddress = parsed.shippingAddress;
      if (parsed.sameAsBilling !== undefined) invoice.sameAsBilling = parsed.sameAsBilling;
      if (parsed.shipBy !== undefined) invoice.shipBy = parsed.shipBy;
      if (parsed.trackingRef !== undefined) invoice.trackingRef = parsed.trackingRef;
      if (parsed.shippingCost !== undefined) invoice.shippingCost = parsed.shippingCost;
      if (parsed.shippingTaxRate !== undefined) invoice.shippingTaxRate = parsed.shippingTaxRate;
      if (parsed.projectId !== undefined) invoice.projectId = parsed.projectId || null;
      if (parsed.projectLabel !== undefined) invoice.projectLabel = parsed.projectLabel;
      if (parsed.invoiceType !== undefined) invoice.invoiceType = parsed.invoiceType;
      if (parsed.branchId !== undefined) {
        const branch = await resolveBranch(req.user.companyId, parsed.branchId || null);
        invoice.branchId = branch ? branch._id : null;
        invoice.branchName = branch ? branch.name : undefined;
      }
      if (parsed.dueDate !== undefined) invoice.dueDate = parseDateOrThrow(parsed.dueDate, "dueDate");

      const shouldRecalc =
        parsed.items !== undefined ||
        parsed.vatRate !== undefined ||
        parsed.shippingCost !== undefined ||
        parsed.shippingTaxRate !== undefined;
      if (parsed.items !== undefined) {
        const hydrated = await hydrateProductFields(req.user.companyId, parsed.items);
        invoice.items = buildItems(hydrated);
      }
      if (parsed.vatRate !== undefined) {
        invoice.vatRate = parsed.vatRate;
      }
      if (shouldRecalc) {
        const { subtotal, vatAmount, total } = calcTotals(
          invoice.items,
          invoice.vatRate,
          invoice.shippingCost || 0,
          invoice.shippingTaxRate || 0
        );
        invoice.subtotal = subtotal;
        invoice.vatAmount = vatAmount;
        invoice.total = total;
        invoice.balance = Math.max(0, invoice.total - invoice.amountPaid);
      }

      if (requiresBranch(invoice.items) && !invoice.branchId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "Branch is required for inventory items" });
      }

      if (parsed.status !== undefined) {
        invoice.status = parsed.status;
        if (parsed.status === "paid") {
          invoice.amountPaid = invoice.total;
          invoice.balance = 0;
        }
      } else if (shouldRecalc) {
        if (invoice.amountPaid <= 0) invoice.status = "sent";
        else if (invoice.balance === 0) invoice.status = "paid";
        else invoice.status = "partial";
      }

      const inventoryResult = await applyInvoiceInventory({
        companyId: req.user.companyId,
        invoice,
        previousInvoice,
        session
      });
      if (inventoryResult.shortages.length > 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          error: "Insufficient stock for this invoice",
          shortages: inventoryResult.shortages
        });
      }

      await invoice.save({ session });
      await replaceInvoiceMovements({ companyId: req.user.companyId, invoice, session });
      await session.commitTransaction();
      session.endSession();

      res.json({ invoice });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    return handleRouteError(res, err, "Failed to update invoice");
  }
});

// Simple payment update (MVP): set amountPaid, auto status
const PaymentUpdateSchema = z.object({
  amountPaid: z.number().nonnegative()
});

router.post("/:id/payment", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "invoice id");
    const parsed = PaymentUpdateSchema.parse(req.body);
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    invoice.amountPaid = parsed.amountPaid;
    invoice.balance = Math.max(0, invoice.total - invoice.amountPaid);

    if (invoice.amountPaid <= 0) invoice.status = "sent";
    else if (invoice.balance === 0) invoice.status = "paid";
    else invoice.status = "partial";

    await invoice.save();
    res.json({ invoice });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update payment");
  }
});

const ZraSubmitSchema = z.object({
  branchId: z.string().optional(),
  reason: z.string().optional(),
  creditNote: z.any().optional()
});

async function resolveZraConnection(companyId, branchId) {
  if (branchId) {
    return ZraConnection.findOne({ companyId, branchId, enabled: true });
  }
  const connections = await ZraConnection.find({ companyId, enabled: true }).limit(2);
  if (connections.length === 1) return connections[0];
  return null;
}

router.post("/:id/zra/submit", requireTaxEnabled(), async (req, res) => {
  try {
    ensureObjectId(req.params.id, "invoice id");
    const parsed = ZraSubmitSchema.parse(req.body || {});
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.lockedAt) return res.status(400).json({ error: "Invoice already submitted to ZRA" });

    const connection = await resolveZraConnection(req.user.companyId, parsed.branchId);
    if (!connection) return res.status(400).json({ error: "ZRA connection not found for branch" });

    const payload = buildZraInvoicePayload(invoice, connection);
    const response = await submitInvoice(connection, payload);

    invoice.zraReceiptNo = response.receiptNo || response.invoiceNo || invoice.invoiceNo;
    invoice.zraMarkId = response.markId || response.markID || response.mark_id;
    invoice.zraSignature = response.signature || response.sign || response.sig;
    invoice.zraQrData = response.qrData || response.qr || response.qrCode;
    invoice.zraStatus = response.status || "ZRA_PENDING";
    invoice.lockedAt = new Date();
    invoice.lockedReason = "ZRA_SUBMITTED";
    invoice.status = mapZraStatus(invoice.zraStatus);
    await invoice.save();

    res.json({ invoice });
  } catch (err) {
    return handleRouteError(res, err, "Failed to submit invoice to ZRA");
  }
});

router.post("/:id/zra/cancel", requireTaxEnabled(), async (req, res) => {
  try {
    ensureObjectId(req.params.id, "invoice id");
    const parsed = ZraSubmitSchema.parse(req.body || {});
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const connection = await resolveZraConnection(req.user.companyId, parsed.branchId);
    if (!connection) return res.status(400).json({ error: "ZRA connection not found for branch" });

    const payload = buildZraCancelPayload(invoice, connection, parsed.reason);
    const response = await submitCancel(connection, payload);

    invoice.zraStatus = response.status || "ZRA_CANCELLED";
    invoice.status = mapZraStatus(invoice.zraStatus);
    invoice.lockedAt = invoice.lockedAt || new Date();
    invoice.lockedReason = invoice.lockedReason || "ZRA_CANCELLED";
    await invoice.save();

    res.json({ invoice });
  } catch (err) {
    return handleRouteError(res, err, "Failed to cancel invoice");
  }
});

router.post("/:id/zra/credit-note", requireTaxEnabled(), async (req, res) => {
  try {
    ensureObjectId(req.params.id, "invoice id");
    const parsed = ZraSubmitSchema.parse(req.body || {});
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const connection = await resolveZraConnection(req.user.companyId, parsed.branchId);
    if (!connection) return res.status(400).json({ error: "ZRA connection not found for branch" });

    const payload = buildZraCreditPayload(invoice, connection, parsed.creditNote || {});
    const response = await submitCreditNote(connection, payload);

    invoice.zraStatus = response.status || "ZRA_CREDIT_NOTE";
    invoice.status = mapZraStatus(invoice.zraStatus);
    invoice.lockedAt = invoice.lockedAt || new Date();
    invoice.lockedReason = invoice.lockedReason || "ZRA_CREDITED";
    await invoice.save();

    res.json({ invoice });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create credit note");
  }
});

module.exports = router;
