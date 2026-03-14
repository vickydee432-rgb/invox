const mongoose = require("mongoose");

const DebitNoteLineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const DebitNoteSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierInvoice", default: null },
    number: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["open", "applied", "cancelled"], default: "open" },
    currency: { type: String, trim: true },
    notes: { type: String, trim: true },
    items: { type: [DebitNoteLineSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

DebitNoteSchema.index({ companyId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("DebitNote", DebitNoteSchema);
