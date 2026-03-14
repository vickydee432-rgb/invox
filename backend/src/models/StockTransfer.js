const mongoose = require("mongoose");

const StockTransferLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const StockTransferSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    fromWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
    toWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["draft", "in_transit", "completed", "cancelled"], default: "completed" },
    notes: { type: String, trim: true },
    items: { type: [StockTransferLineSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockTransfer", StockTransferSchema);
