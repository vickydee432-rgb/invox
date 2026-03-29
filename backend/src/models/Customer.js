const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, trim: true, index: true },

    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    tags: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

CustomerSchema.index({ companyId: 1, name: 1 });
CustomerSchema.index({ companyId: 1, phone: 1 });

module.exports = mongoose.model("Customer", CustomerSchema);

