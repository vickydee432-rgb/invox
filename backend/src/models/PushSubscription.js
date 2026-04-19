const mongoose = require("mongoose");

const PushSubscriptionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: String, trim: true, index: true },
    endpoint: { type: String, required: true, trim: true },
    keys: {
      p256dh: { type: String, required: true, trim: true },
      auth: { type: String, required: true, trim: true }
    },
    expirationTime: { type: Number, default: null },
    userAgent: { type: String, trim: true },
    lastSeenAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ companyId: 1, endpoint: 1 }, { unique: true });
PushSubscriptionSchema.index({ companyId: 1, userId: 1, deviceId: 1 });

module.exports = mongoose.model("PushSubscription", PushSubscriptionSchema);

