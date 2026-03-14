const mongoose = require("mongoose");

const SupplierSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    taxNumber: { type: String, trim: true },
    termsDays: { type: Number, default: 30 },
    creditLimit: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

SupplierSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model("Supplier", SupplierSchema);
