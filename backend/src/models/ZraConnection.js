const mongoose = require("mongoose");

const ZraConnectionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    tpin: { type: String, required: true, trim: true },
    branchId: { type: String, required: true, trim: true },
    branchName: { type: String, trim: true },
    enabled: { type: Boolean, default: true },
    syncEnabled: { type: Boolean, default: true },
    syncIntervalMinutes: { type: Number, default: 5, min: 1, max: 60 },
    baseUrl: { type: String, trim: true },
    credentials: {
      cipherText: { type: String, required: true },
      iv: { type: String, required: true },
      tag: { type: String, required: true }
    },
    lastSyncAt: { type: Date },
    lastSyncStatus: { type: String, trim: true },
    lastSyncError: { type: String, trim: true },
    failureCount: { type: Number, default: 0, min: 0 },
    backoffUntil: { type: Date }
  },
  { timestamps: true }
);

ZraConnectionSchema.index({ companyId: 1, branchId: 1 }, { unique: true });
ZraConnectionSchema.index({ companyId: 1, enabled: 1, syncEnabled: 1 });

module.exports = mongoose.model("ZraConnection", ZraConnectionSchema);
