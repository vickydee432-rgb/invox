const mongoose = require("mongoose");

const JournalLineSchema = new mongoose.Schema(
  {
    journalId: { type: mongoose.Schema.Types.ObjectId, ref: "Journal", required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true },
    exchangeRate: { type: Number, default: 1 }
  },
  { timestamps: true }
);

JournalLineSchema.index({ companyId: 1, journalId: 1 });

module.exports = mongoose.model("JournalLine", JournalLineSchema);
