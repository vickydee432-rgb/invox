const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    onHand: { type: Number, default: 0 },
    avgCost: { type: Number, default: 0 }
  },
  { timestamps: true }
);

StockSchema.index({ companyId: 1, branchId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model("Stock", StockSchema);
