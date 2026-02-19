const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    address: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

BranchSchema.index({ companyId: 1, code: 1 }, { unique: true, sparse: true });
BranchSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model("Branch", BranchSchema);
