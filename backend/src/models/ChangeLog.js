const mongoose = require("mongoose");

const ChangeLogSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deviceId: { type: String, trim: true },
    entityType: { type: String, required: true, index: true },
    recordId: { type: String, required: true, index: true },
    operation: { type: String, enum: ["create", "update", "delete"], required: true },
    version: { type: Number, default: 1 },
    payload: { type: mongoose.Schema.Types.Mixed },
    idempotencyKey: { type: String, trim: true },
    changedAt: { type: Date, default: () => new Date(), index: true }
  },
  { timestamps: true }
);

ChangeLogSchema.index({ companyId: 1, workspaceId: 1, changedAt: 1 });
ChangeLogSchema.index({ companyId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("ChangeLog", ChangeLogSchema);
