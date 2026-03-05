const mongoose = require("mongoose");

const SyncOpSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    idempotencyKey: { type: String, required: true, trim: true },
    result: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ["ok", "failed", "conflict"], default: "ok" }
  },
  { timestamps: true }
);

SyncOpSchema.index({ companyId: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model("SyncOp", SyncOpSchema);
