const mongoose = require("mongoose");

const BankAccountSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    accountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    currency: { type: String, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

BankAccountSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model("BankAccount", BankAccountSchema);
