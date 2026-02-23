const mongoose = require("mongoose");

const UserInviteSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    acceptedAt: { type: Date },
    revokedAt: { type: Date }
  },
  { timestamps: true }
);

UserInviteSchema.index({ companyId: 1, email: 1, acceptedAt: 1, revokedAt: 1 });

module.exports = mongoose.model("UserInvite", UserInviteSchema);
