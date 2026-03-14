const mongoose = require("mongoose");

const TaxReturnSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    period: { type: String, required: true, trim: true },
    type: { type: String, enum: ["VAT", "Turnover", "Withholding"], required: true },
    status: { type: String, enum: ["draft", "submitted", "paid"], default: "draft" },
    totals: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

TaxReturnSchema.index({ companyId: 1, period: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("TaxReturn", TaxReturnSchema);
