const mongoose = require("mongoose");

const BankTransactionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    description: { type: String, trim: true },
    reference: { type: String, trim: true },
    matchedRefType: { type: String, trim: true },
    matchedRefId: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  { timestamps: true }
);

BankTransactionSchema.index({ companyId: 1, bankAccountId: 1, date: -1 });

module.exports = mongoose.model("BankTransaction", BankTransactionSchema);
