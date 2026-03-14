const mongoose = require("mongoose");

const SupplierInvoiceLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const SupplierInvoiceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    number: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["draft", "open", "paid", "overdue", "cancelled"], default: "open" },
    currency: { type: String, trim: true },
    notes: { type: String, trim: true },
    items: { type: [SupplierInvoiceLineSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

SupplierInvoiceSchema.index({ companyId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("SupplierInvoice", SupplierInvoiceSchema);
