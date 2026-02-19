const mongoose = require("mongoose");

const InvoiceItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productSku: { type: String, trim: true },
    productName: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true },
    customerTpin: { type: String, trim: true },
    billingAddress: { type: String, trim: true },
    shippingAddress: { type: String, trim: true },
    sameAsBilling: { type: Boolean, default: false },
    shipBy: { type: String, trim: true },
    trackingRef: { type: String, trim: true },
    shippingCost: { type: Number, default: 0, min: 0 },
    shippingTaxRate: { type: Number, default: 0, min: 0 },
    source: { type: String, enum: ["APP", "ZRA"], default: "APP", index: true },
    zraReceiptNo: { type: String, trim: true },
    zraMarkId: { type: String, trim: true },
    zraSignature: { type: String, trim: true },
    zraQrData: { type: String, trim: true },
    zraStatus: { type: String, trim: true },
    lockedAt: { type: Date },
    lockedReason: { type: String, trim: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    projectLabel: { type: String, trim: true },
    invoiceType: { type: String, enum: ["sale", "purchase"], default: "sale", index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    branchName: { type: String, trim: true },

    status: {
      type: String,
      enum: [
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
      ],
      default: "sent",
      index: true
    },

    issueDate: { type: Date, default: () => new Date() },
    dueDate: { type: Date, required: true },

    items: { type: [InvoiceItemSchema], default: [] },

    subtotal: { type: Number, required: true, min: 0 },
    vatRate: { type: Number, default: 0, min: 0 },
    vatAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },

    sourceQuoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", default: null }
  },
  { timestamps: true }
);

InvoiceSchema.index({ companyId: 1, invoiceNo: 1 }, { unique: true });
InvoiceSchema.index({ projectId: 1, issueDate: -1 });
InvoiceSchema.index({ dueDate: 1 });

module.exports = mongoose.model("Invoice", InvoiceSchema);
