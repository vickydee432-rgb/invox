const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    actorEmail: { type: String, trim: true, lowercase: true },
    action: { type: String, trim: true },
    entityType: { type: String, trim: true },
    entityId: { type: String, trim: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    statusCode: { type: Number },
    metadata: { type: mongoose.Schema.Types.Mixed },
    dataRegion: { type: String, trim: true },
    expiresAt: { type: Date, index: true }
  },
  { timestamps: true }
);

AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
