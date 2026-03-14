const mongoose = require("mongoose");

const BankReconciliationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", required: true },
    period: { type: String, required: true, trim: true },
    closingBalance: { type: Number, required: true },
    status: { type: String, enum: ["open", "closed"], default: "open" }
  },
  { timestamps: true }
);

BankReconciliationSchema.index({ companyId: 1, bankAccountId: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("BankReconciliation", BankReconciliationSchema);
