const mongoose = require("mongoose");

const ZraDocumentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: String, required: true, trim: true },
    tpin: { type: String, required: true, trim: true },
    docType: { type: String, required: true, trim: true },
    receiptNo: { type: String, required: true, trim: true },
    markId: { type: String, trim: true },
    signature: { type: String, trim: true },
    qrData: { type: String, trim: true },
    zraStatus: { type: String, trim: true },
    issueDate: { type: Date },
    dueDate: { type: Date },
    currency: { type: String, trim: true },
    total: { type: Number },
    source: { type: String, enum: ["APP", "ZRA"], default: "ZRA" },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
    lastSyncedAt: { type: Date }
  },
  { timestamps: true }
);

ZraDocumentSchema.index({ companyId: 1, branchId: 1, receiptNo: 1, docType: 1 }, { unique: true });
ZraDocumentSchema.index({ companyId: 1, zraStatus: 1 });

module.exports = mongoose.model("ZraDocument", ZraDocumentSchema);
