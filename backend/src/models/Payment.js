const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    deviceId: { type: String, trim: true, index: true },

    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    invoiceNo: { type: String, trim: true, index: true },
    customerName: { type: String, trim: true },

    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true },
    method: { type: String, trim: true },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },

    version: { type: Number, default: 1 },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

PaymentSchema.index({ companyId: 1, workspaceId: 1, date: -1 });
PaymentSchema.index({ companyId: 1, invoiceId: 1, date: -1 });

module.exports = mongoose.model("Payment", PaymentSchema);

