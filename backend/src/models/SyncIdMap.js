const mongoose = require("mongoose");

const SyncIdMapSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    localId: { type: String, required: true, index: true },
    serverId: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

SyncIdMapSchema.index({ companyId: 1, workspaceId: 1, entityType: 1, localId: 1 }, { unique: true });
SyncIdMapSchema.index({ companyId: 1, workspaceId: 1, entityType: 1, serverId: 1 }, { unique: true });

module.exports = mongoose.model("SyncIdMap", SyncIdMapSchema);
