const mongoose = require("mongoose");

const PhoneInventoryItemSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    deviceId: { type: String, trim: true, index: true },

    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    storage: { type: String, trim: true },
    color: { type: String, trim: true },
    condition: { type: String, trim: true },

    imei: { type: String, trim: true, index: true },
    serial: { type: String, trim: true, index: true },

    costPrice: { type: Number, default: 0, min: 0 },
    salePrice: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["in_stock", "reserved", "sold", "in_repair", "returned"],
      default: "in_stock",
      index: true
    },

    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },

    receivedAt: { type: Date, default: () => new Date(), index: true },
    soldAt: { type: Date },
    soldSaleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null, index: true },

    notes: { type: String, trim: true },

    version: { type: Number, default: 1 },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

PhoneInventoryItemSchema.index({ companyId: 1, imei: 1 }, { unique: true, sparse: true });
PhoneInventoryItemSchema.index({ companyId: 1, serial: 1 }, { unique: true, sparse: true });
PhoneInventoryItemSchema.index({ companyId: 1, status: 1, receivedAt: -1 });

module.exports = mongoose.model("PhoneInventoryItem", PhoneInventoryItemSchema);

