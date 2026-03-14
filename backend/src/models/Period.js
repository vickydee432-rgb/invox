const mongoose = require("mongoose");

const PeriodSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    fiscalYearId: { type: mongoose.Schema.Types.ObjectId, ref: "FiscalYear", default: null },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isClosed: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

PeriodSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Period", PeriodSchema);
