const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: String, required: true, trim: true, index: true },
    name: { type: String, trim: true },
    platform: { type: String, trim: true },
    lastSeenAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

DeviceSchema.index({ companyId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model("Device", DeviceSchema);
