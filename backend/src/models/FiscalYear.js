const mongoose = require("mongoose");

const FiscalYearSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

FiscalYearSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("FiscalYear", FiscalYearSchema);
