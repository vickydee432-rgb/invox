const mongoose = require("mongoose");

const TradeInSchema = new mongoose.Schema(
  {
    tradeInNo: { type: String, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    deviceId: { type: String, trim: true, index: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },

    deviceBrand: { type: String, trim: true },
    deviceModel: { type: String, trim: true },
    imei: { type: String, trim: true, index: true },
    serial: { type: String, trim: true, index: true },
    storage: { type: String, trim: true },
    condition: { type: String, trim: true },

    offeredAmount: { type: Number, default: 0, min: 0 },
    agreedAmount: { type: Number, default: 0, min: 0 },
    creditAmount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "applied", "cancelled"],
      default: "pending",
      index: true
    },

    appliedSaleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null, index: true },
    appliedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },

    notes: { type: String, trim: true },

    version: { type: Number, default: 1 },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

TradeInSchema.index({ companyId: 1, tradeInNo: 1 }, { unique: true });
TradeInSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("TradeIn", TradeInSchema);

