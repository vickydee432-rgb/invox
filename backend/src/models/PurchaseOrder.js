const mongoose = require("mongoose");

const PurchaseLineSchema = new mongoose.Schema(
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

const PurchaseOrderSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    number: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    expectedDate: { type: Date },
    status: { type: String, enum: ["draft", "sent", "received", "cancelled"], default: "draft" },
    currency: { type: String, trim: true },
    notes: { type: String, trim: true },
    items: { type: [PurchaseLineSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

PurchaseOrderSchema.index({ companyId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("PurchaseOrder", PurchaseOrderSchema);
