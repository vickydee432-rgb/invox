const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["Asset", "Liability", "Equity", "Income", "Expense"],
      required: true,
      index: true
    },
    subType: { type: String, trim: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    isControl: { type: Boolean, default: false },
    currency: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

AccountSchema.index({ companyId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Account", AccountSchema);
