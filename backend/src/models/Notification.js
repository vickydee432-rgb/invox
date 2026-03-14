const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["unread", "read", "dismissed"], default: "unread" },
    triggeredAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

NotificationSchema.index({ companyId: 1, userId: 1, triggeredAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
