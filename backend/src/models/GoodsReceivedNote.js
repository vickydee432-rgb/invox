const mongoose = require("mongoose");

const GrnLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const GoodsReceivedNoteSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", default: null },
    number: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["received", "cancelled"], default: "received" },
    notes: { type: String, trim: true },
    items: { type: [GrnLineSchema], default: [] }
  },
  { timestamps: true }
);

GoodsReceivedNoteSchema.index({ companyId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("GoodsReceivedNote", GoodsReceivedNoteSchema);
