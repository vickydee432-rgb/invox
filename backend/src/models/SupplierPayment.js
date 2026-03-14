const mongoose = require("mongoose");

const SupplierPaymentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierInvoice", default: null },
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, trim: true },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

SupplierPaymentSchema.index({ companyId: 1, supplierId: 1, date: -1 });

module.exports = mongoose.model("SupplierPayment", SupplierPaymentSchema);
