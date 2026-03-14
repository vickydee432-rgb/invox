const mongoose = require("mongoose");

const WarehouseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

WarehouseSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model("Warehouse", WarehouseSchema);
