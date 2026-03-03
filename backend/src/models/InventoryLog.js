const mongoose = require("mongoose");

const InventoryLogSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    change: { type: Number, required: true },
    previousQty: { type: Number, required: true },
    newQty: { type: Number, required: true },
    reason: { type: String, trim: true },
    note: { type: String, trim: true }
  },
  { timestamps: true }
);

InventoryLogSchema.index({ companyId: 1, productId: 1, branchId: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryLog", InventoryLogSchema);
