const express = require("express");
const { z } = require("zod");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Branch = require("../models/Branch");
const ChangeLog = require("../models/ChangeLog");
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
const { requireModule } = require("../middleware/workspace");
const { applyInvoiceInventory, replaceInvoiceMovements } = require("../services/inventory");
const { buildSalesWorkbook } = require("../services/export");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("sales"));

const SaleCreateSchema = z.object({
  saleNo: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerTpin: z.string().optional(),
  branchId: z.string().optional(),
  issueDate: z.string().optional(),
  status: z.enum(["paid", "partial", "unpaid", "cancelled"]).optional(),
  amountPaid: z.number().min(0).optional(),
  vatRate: z.number().min(0).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        productSku: z.string().optional(),
        productName: z.string().optional(),
        description: z.string().min(1),
        qty: z.number().nonnegative(),
        unitPrice: z.number().nonnegative(),
        discount: z.number().nonnegative().optional()
      })
    )
    .min(1)
});

const SaleUpdateSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerTpin: z.string().optional(),
  branchId: z.string().optional(),
  issueDate: z.string().optional(),
  status: z.enum(["paid", "partial", "unpaid", "cancelled"]).optional(),
  vatRate: z.number().min(0).optional(),
  amountPaid: z.number().min(0).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        productSku: z.string().optional(),
        productName: z.string().optional(),
        description: z.string().min(1),
        qty: z.number().nonnegative(),
        unitPrice: z.number().nonnegative(),
        discount: z.number().nonnegative().optional()
      })
    )
    .optional()
});

function requiresBranch(items) {
  return items.some((item) => Boolean(item.productId));
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

async function logSaleChange({ sale, operation, req }) {
  if (!sale) return;
  const payload = sale.toObject ? sale.toObject() : sale;
  await ChangeLog.create({
    companyId: sale.companyId,
    workspaceId: sale.workspaceId || String(req.user.companyId),
    userId: req.user._id,
    deviceId: sale.deviceId || req.headers["x-device-id"] || "server",
    entityType: "sale",
    recordId: sale._id.toString(),
    operation,
    version: sale.version || 1,
    payload,
    changedAt: new Date()
  });
}

function buildSaleFilter(query) {
  const { status, from, to, q } = query;
  const filter = { deletedAt: null };
  if (status) filter.status = status;
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

router.get("/", async (req, res) => {
  try {
    const { limit, page } = req.query;
    const filter = { ...buildSaleFilter(req.query), companyId: req.user.companyId };
    const safeLimit = parseLimit(limit, { defaultLimit: 200, maxLimit: 500 });
    const pageNum = parsePage(page);
    const total = await Sale.countDocuments(filter);
    const skip = (pageNum - 1) * safeLimit;
    const sales = await Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: sales.length, sales });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list sales");
  }
});

// Export sales to Excel
router.get("/export.xlsx", async (req, res) => {
  try {
    const { limit } = req.query;
    const filter = { ...buildSaleFilter(req.query), companyId: req.user.companyId };
    const safeLimit = parseLimit(limit, { defaultLimit: 2000, maxLimit: 5000 });
    const sales = await Sale.find(filter).sort({ createdAt: -1 }).limit(safeLimit).lean();
    const workbook = buildSalesWorkbook(sales);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="sales.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleRouteError(res, err, "Failed to export sales");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "sale id");
    const sale = await Sale.findOne({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null }).lean();
    if (!sale) return res.status(404).json({ error: "Sale not found" });
    res.json({ sale });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get sale");
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = SaleCreateSchema.parse(req.body);
    let saleNo = parsed.saleNo ? parsed.saleNo.trim() : "";
    if (saleNo) {
      const existing = await Sale.findOne({ companyId: req.user.companyId, saleNo }).lean();
      if (existing) return res.status(400).json({ error: "Sale number already exists" });
    } else {
      saleNo = await nextNumber("SAL", Sale, "saleNo", "^SAL-");
    }

    const hydratedItems = await hydrateProductFields(req.user.companyId, parsed.items);
    const items = buildItems(hydratedItems);
    const vatRate = parsed.vatRate ?? 0;
    const { subtotal, vatAmount, total } = calcTotals(items, vatRate, 0, 0);
    const issueDate = parseOptionalDate(parsed.issueDate, "issueDate") || new Date();
    const status = parsed.status || "paid";
    const amountPaidRaw = parsed.amountPaid !== undefined ? parsed.amountPaid : status === "paid" ? total : 0;
    const amountPaid = Math.min(total, Math.max(0, amountPaidRaw));
    const balance = Math.max(0, total - amountPaid);

    const branch = await resolveBranch(req.user.companyId, parsed.branchId);
    if (!branch && requiresBranch(items)) {
      return res.status(400).json({ error: "Branch is required for inventory items" });
    }

    const session = await Sale.startSession();
    session.startTransaction();
    let sale;
    try {
      sale = new Sale({
        saleNo,
        companyId: req.user.companyId,
        workspaceId: String(req.user.companyId),
        userId: req.user._id,
        deviceId: String(req.headers["x-device-id"] || "server"),
        customerName: parsed.customerName || "Walk-in",
        customerPhone: parsed.customerPhone,
        customerTpin: parsed.customerTpin,
        branchId: branch ? branch._id : null,
        branchName: branch ? branch.name : undefined,
        issueDate,
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
        invoice: { ...sale.toObject(), invoiceType: "sale" },
        previousInvoice: null,
        session
      });
      if (inventoryResult.shortages.length > 0) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Insufficient stock for this sale",
          shortages: inventoryResult.shortages
        });
      }

      await sale.save({ session });
      await replaceInvoiceMovements({
        companyId: req.user.companyId,
        invoice: { ...sale.toObject(), invoiceType: "sale" },
        session,
        sourceType: "sale",
        note: sale.saleNo
      });
      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      session.endSession();
    }
    if (sale) {
      try {
        await logSaleChange({ sale, operation: "create", req });
      } catch (err) {
        // ignore log failures
      }
    }
    return res.status(201).json({ sale });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create sale");
  }
});

router.put("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "sale id");
    const parsed = SaleUpdateSchema.parse(req.body);
    const session = await Sale.startSession();
    session.startTransaction();
    let sale;
    try {
      sale = await Sale.findOne({ _id: req.params.id, companyId: req.user.companyId }).session(session);
      if (!sale) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.status(404).json({ error: "Sale not found" });
      }

      const previous = sale.toObject();
      const nextItemsRaw = parsed.items ? await hydrateProductFields(req.user.companyId, parsed.items) : sale.items;
      const items = buildItems(nextItemsRaw);
      const vatRate = parsed.vatRate ?? sale.vatRate ?? 0;
      const { subtotal, vatAmount, total } = calcTotals(items, vatRate, 0, 0);
      const status = parsed.status || sale.status;
      const amountPaidRaw =
        parsed.amountPaid !== undefined ? parsed.amountPaid : status === "paid" ? total : sale.amountPaid;
      const amountPaid = Math.min(total, Math.max(0, amountPaidRaw));
      const balance = Math.max(0, total - amountPaid);

      if (parsed.branchId !== undefined && parsed.branchId) {
        ensureObjectId(parsed.branchId, "branch id");
      }
      const branch = await resolveBranch(req.user.companyId, parsed.branchId || sale.branchId);
      if (!branch && requiresBranch(items)) {
        await session.abortTransaction();
        return res.status(400).json({ error: "Branch is required for inventory items" });
      }

      if (parsed.customerName !== undefined) sale.customerName = parsed.customerName || "Walk-in";
      if (parsed.customerPhone !== undefined) sale.customerPhone = parsed.customerPhone;
      if (parsed.customerTpin !== undefined) sale.customerTpin = parsed.customerTpin;
      if (parsed.issueDate !== undefined) sale.issueDate = parseDateOrThrow(parsed.issueDate, "issueDate");
      if (parsed.status !== undefined) sale.status = parsed.status;
      if (parsed.vatRate !== undefined) sale.vatRate = parsed.vatRate;
      if (parsed.items !== undefined) sale.items = items;
      sale.branchId = branch ? branch._id : null;
      sale.branchName = branch ? branch.name : undefined;
      sale.subtotal = subtotal;
      sale.vatAmount = vatAmount;
      sale.total = total;
      sale.amountPaid = amountPaid;
      sale.balance = balance;
      sale.workspaceId = sale.workspaceId || String(req.user.companyId);
      sale.userId = req.user._id;
      sale.deviceId = String(req.headers["x-device-id"] || "server");
      sale.version = (sale.version || 1) + 1;

      const inventoryResult = await applyInvoiceInventory({
        companyId: req.user.companyId,
        invoice: { ...sale.toObject(), invoiceType: "sale" },
        previousInvoice: { ...previous, invoiceType: "sale" },
        session
      });
      if (inventoryResult.shortages.length > 0) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Insufficient stock for this sale update",
          shortages: inventoryResult.shortages
        });
      }

      await sale.save({ session });
      await replaceInvoiceMovements({
        companyId: req.user.companyId,
        invoice: { ...sale.toObject(), invoiceType: "sale" },
        session,
        sourceType: "sale",
        note: sale.saleNo
      });
      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      session.endSession();
    }
    if (sale) {
      try {
        await logSaleChange({ sale, operation: "update", req });
      } catch (err) {
        // ignore log failures
      }
    }
    res.json({ sale });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update sale");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "sale id");
    const session = await Sale.startSession();
    session.startTransaction();
    let sale;
    try {
      sale = await Sale.findOne({ _id: req.params.id, companyId: req.user.companyId }).session(session);
      if (!sale) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.status(404).json({ error: "Sale not found" });
      }

      const clearedSale = { ...sale.toObject(), items: [], invoiceType: "sale" };
      const inventoryResult = await applyInvoiceInventory({
        companyId: req.user.companyId,
        invoice: clearedSale,
        previousInvoice: { ...sale.toObject(), invoiceType: "sale" },
        session
      });
      if (inventoryResult.shortages.length > 0) {
        await session.abortTransaction();
        return res.status(409).json({
          error: "Insufficient stock to delete this sale",
          shortages: inventoryResult.shortages
        });
      }

      await replaceInvoiceMovements({
        companyId: req.user.companyId,
        invoice: clearedSale,
        session,
        sourceType: "sale",
        note: sale.saleNo
      });
      sale.deletedAt = new Date();
      sale.version = (sale.version || 1) + 1;
      sale.workspaceId = sale.workspaceId || String(req.user.companyId);
      sale.userId = req.user._id;
      sale.deviceId = String(req.headers["x-device-id"] || "server");
      await sale.save({ session });
      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      session.endSession();
    }
    if (sale) {
      try {
        await logSaleChange({ sale, operation: "delete", req });
      } catch (err) {
        // ignore log failures
      }
    }
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete sale");
  }
});

module.exports = router;
