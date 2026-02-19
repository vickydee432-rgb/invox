const mongoose = require("mongoose");

const StockMovementSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    type: { type: String, enum: ["purchase", "sale", "adjustment"], required: true },
    qty: { type: Number, required: true }, // positive in, negative out
    unitCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    sourceType: { type: String, trim: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    note: { type: String, trim: true }
  },
  { timestamps: true }
);

StockMovementSchema.index({ companyId: 1, sourceType: 1, sourceId: 1 });
StockMovementSchema.index({ companyId: 1, branchId: 1, productId: 1, createdAt: -1 });

module.exports = mongoose.model("StockMovement", StockMovementSchema);
