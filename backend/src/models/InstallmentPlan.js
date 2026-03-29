const mongoose = require("mongoose");

const InstallmentPaymentSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, trim: true },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date, default: () => new Date() }
  },
  { _id: false }
);

const InstallmentPlanSchema = new mongoose.Schema(
  {
    planNo: { type: String, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    deviceId: { type: String, trim: true, index: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },

    referenceType: { type: String, enum: ["sale", "invoice", "other"], default: "sale", index: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
    referenceNo: { type: String, trim: true },

    totalAmount: { type: Number, required: true, min: 0 },
    downPayment: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, required: true, min: 0 },

    installmentCount: { type: Number, default: 1, min: 1 },
    frequency: { type: String, enum: ["weekly", "biweekly", "monthly"], default: "monthly" },
    startDate: { type: Date, default: () => new Date() },
    nextDueDate: { type: Date, index: true },

    status: { type: String, enum: ["active", "completed", "defaulted", "cancelled"], default: "active", index: true },

    payments: { type: [InstallmentPaymentSchema], default: [] },

    notes: { type: String, trim: true },

    version: { type: Number, default: 1 },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

InstallmentPlanSchema.index({ companyId: 1, planNo: 1 }, { unique: true });
InstallmentPlanSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("InstallmentPlan", InstallmentPlanSchema);

