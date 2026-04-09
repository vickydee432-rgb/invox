const mongoose = require("mongoose");

const SuperAdminSsoCodeSchema = new mongoose.Schema(
  {
    codeHash: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date }
  },
  { timestamps: true }
);

// Auto-delete expired codes.
SuperAdminSsoCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("SuperAdminSsoCode", SuperAdminSsoCodeSchema);
