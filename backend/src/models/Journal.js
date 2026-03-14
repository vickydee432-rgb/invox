const mongoose = require("mongoose");

const JournalSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    date: { type: Date, required: true, index: true },
    refType: { type: String, trim: true },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    memo: { type: String, trim: true },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: "Period", default: null },
    currency: { type: String, trim: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

JournalSchema.index({ companyId: 1, date: -1 });
JournalSchema.index({ companyId: 1, refType: 1, refId: 1 });

module.exports = mongoose.model("Journal", JournalSchema);
