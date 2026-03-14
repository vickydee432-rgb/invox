const express = require("express");
const { z } = require("zod");
const Supplier = require("../models/Supplier");
const PurchaseOrder = require("../models/PurchaseOrder");
const GoodsReceivedNote = require("../models/GoodsReceivedNote");
const SupplierInvoice = require("../models/SupplierInvoice");
const DebitNote = require("../models/DebitNote");
const SupplierPayment = require("../models/SupplierPayment");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { ensureObjectId, handleRouteError } = require("./_helpers");
const { postSupplierInvoice } = require("../services/ledger");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("purchases"));

function calcTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const taxAmount = items.reduce(
    (sum, item) => sum + (Number(item.lineTotal || 0) * (Number(item.taxRate || 0) / 100)),
    0
  );
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

const SupplierSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
  termsDays: z.number().int().optional(),
  creditLimit: z.number().optional()
});

router.get("/suppliers", async (req, res) => {
  try {
    const suppliers = await Supplier.find({ companyId: req.user.companyId }).sort({ name: 1 }).lean();
    res.json({ suppliers });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load suppliers");
  }
});

router.post("/suppliers", async (req, res) => {
  try {
    const parsed = SupplierSchema.parse(req.body);
    const supplier = await Supplier.create({ companyId: req.user.companyId, ...parsed });
    res.status(201).json({ supplier });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create supplier");
  }
});

const LineSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1),
  qty: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional()
});

const PurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  number: z.string().min(1),
  date: z.string().min(1),
  expectedDate: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(LineSchema).min(1)
});

router.get("/purchase-orders", async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ companyId: req.user.companyId }).sort({ date: -1 }).lean();
    res.json({ orders });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load purchase orders");
  }
});

router.post("/purchase-orders", async (req, res) => {
  try {
    const parsed = PurchaseOrderSchema.parse(req.body);
    ensureObjectId(parsed.supplierId, "supplier id");
    const items = parsed.items.map((item) => ({
      ...item,
      discount: Number(item.discount || 0),
      taxRate: Number(item.taxRate || 0),
      lineTotal: Number(item.qty) * Number(item.unitPrice) - Number(item.discount || 0)
    }));
    const totals = calcTotals(items);
    const order = await PurchaseOrder.create({
      companyId: req.user.companyId,
      supplierId: parsed.supplierId,
      number: parsed.number,
      date: new Date(parsed.date),
      expectedDate: parsed.expectedDate ? new Date(parsed.expectedDate) : null,
      currency: parsed.currency,
      notes: parsed.notes,
      items,
      ...totals
    });
    res.status(201).json({ order });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create purchase order");
  }
});

const GrnSchema = z.object({
  supplierId: z.string().min(1),
  purchaseOrderId: z.string().optional(),
  number: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        description: z.string().min(1),
        qty: z.number().nonnegative()
      })
    )
    .min(1)
});

router.get("/grns", async (req, res) => {
  try {
    const grns = await GoodsReceivedNote.find({ companyId: req.user.companyId }).sort({ date: -1 }).lean();
    res.json({ grns });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load GRNs");
  }
});

router.post("/grns", async (req, res) => {
  try {
    const parsed = GrnSchema.parse(req.body);
    ensureObjectId(parsed.supplierId, "supplier id");
    if (parsed.purchaseOrderId) ensureObjectId(parsed.purchaseOrderId, "purchase order id");
    const grn = await GoodsReceivedNote.create({
      companyId: req.user.companyId,
      supplierId: parsed.supplierId,
      purchaseOrderId: parsed.purchaseOrderId || null,
      number: parsed.number,
      date: new Date(parsed.date),
      notes: parsed.notes,
      items: parsed.items
    });
    res.status(201).json({ grn });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create GRN");
  }
});

const SupplierInvoiceSchema = z.object({
  supplierId: z.string().min(1),
  number: z.string().min(1),
  date: z.string().min(1),
  dueDate: z.string().min(1),
  currency: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(LineSchema).min(1)
});

router.get("/supplier-invoices", async (req, res) => {
  try {
    const invoices = await SupplierInvoice.find({ companyId: req.user.companyId }).sort({ date: -1 }).lean();
    res.json({ invoices });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load supplier invoices");
  }
});

router.post("/supplier-invoices", async (req, res) => {
  try {
    const parsed = SupplierInvoiceSchema.parse(req.body);
    ensureObjectId(parsed.supplierId, "supplier id");
    const items = parsed.items.map((item) => ({
      ...item,
      discount: Number(item.discount || 0),
      taxRate: Number(item.taxRate || 0),
      lineTotal: Number(item.qty) * Number(item.unitPrice) - Number(item.discount || 0)
    }));
    const totals = calcTotals(items);
    const invoice = await SupplierInvoice.create({
      companyId: req.user.companyId,
      supplierId: parsed.supplierId,
      number: parsed.number,
      date: new Date(parsed.date),
      dueDate: new Date(parsed.dueDate),
      currency: parsed.currency,
      notes: parsed.notes,
      items,
      ...totals,
      amountPaid: 0,
      balance: totals.total
    });

    try {
      await postSupplierInvoice({ companyId: req.user.companyId, supplierInvoice: invoice });
    } catch (err) {
      console.warn("Ledger posting failed for supplier invoice", err);
    }

    res.status(201).json({ invoice });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create supplier invoice");
  }
});

const DebitNoteSchema = z.object({
  supplierId: z.string().min(1),
  supplierInvoiceId: z.string().optional(),
  number: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        qty: z.number().nonnegative(),
        unitPrice: z.number().nonnegative(),
        taxRate: z.number().nonnegative().optional()
      })
    )
    .min(1)
});

router.get("/debit-notes", async (req, res) => {
  try {
    const notes = await DebitNote.find({ companyId: req.user.companyId }).sort({ date: -1 }).lean();
    res.json({ notes });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load debit notes");
  }
});

router.post("/debit-notes", async (req, res) => {
  try {
    const parsed = DebitNoteSchema.parse(req.body);
    ensureObjectId(parsed.supplierId, "supplier id");
    if (parsed.supplierInvoiceId) ensureObjectId(parsed.supplierInvoiceId, "supplier invoice id");
    const items = parsed.items.map((item) => ({
      ...item,
      taxRate: Number(item.taxRate || 0),
      lineTotal: Number(item.qty) * Number(item.unitPrice)
    }));
    const totals = calcTotals(items);
    const note = await DebitNote.create({
      companyId: req.user.companyId,
      supplierId: parsed.supplierId,
      supplierInvoiceId: parsed.supplierInvoiceId || null,
      number: parsed.number,
      date: new Date(parsed.date),
      notes: parsed.notes,
      items,
      ...totals
    });
    res.status(201).json({ note });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create debit note");
  }
});

const SupplierPaymentSchema = z.object({
  supplierId: z.string().min(1),
  supplierInvoiceId: z.string().optional(),
  date: z.string().min(1),
  amount: z.number().nonnegative(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional()
});

router.get("/supplier-payments", async (req, res) => {
  try {
    const payments = await SupplierPayment.find({ companyId: req.user.companyId }).sort({ date: -1 }).lean();
    res.json({ payments });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load supplier payments");
  }
});

router.post("/supplier-payments", async (req, res) => {
  try {
    const parsed = SupplierPaymentSchema.parse(req.body);
    ensureObjectId(parsed.supplierId, "supplier id");
    if (parsed.supplierInvoiceId) ensureObjectId(parsed.supplierInvoiceId, "supplier invoice id");
    const payment = await SupplierPayment.create({
      companyId: req.user.companyId,
      supplierId: parsed.supplierId,
      supplierInvoiceId: parsed.supplierInvoiceId || null,
      date: new Date(parsed.date),
      amount: parsed.amount,
      method: parsed.method,
      reference: parsed.reference,
      notes: parsed.notes
    });
    res.status(201).json({ payment });
  } catch (err) {
    return handleRouteError(res, err, "Failed to record supplier payment");
  }
});

module.exports = router;
