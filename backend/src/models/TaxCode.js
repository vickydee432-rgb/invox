const mongoose = require("mongoose");

const TaxCodeSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ["VAT", "Turnover", "Withholding"], required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

TaxCodeSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model("TaxCode", TaxCodeSchema);
