const mongoose = require("mongoose");

const PayrunSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    period: { type: String, required: true, trim: true },
    status: { type: String, enum: ["draft", "processed", "closed"], default: "processed" },
    generatedAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

PayrunSchema.index({ companyId: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("Payrun", PayrunSchema);
