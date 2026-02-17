const mongoose = require("mongoose");

const InvoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true },
    customerTpin: { type: String, trim: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    projectLabel: { type: String, trim: true },

    status: {
      type: String,
      enum: ["draft", "sent", "paid", "partial", "overdue", "cancelled"],
      default: "sent",
      index: true
    },

    issueDate: { type: Date, default: () => new Date() },
    dueDate: { type: Date, required: true },

    items: { type: [InvoiceItemSchema], default: [] },

    subtotal: { type: Number, required: true, min: 0 },
    vatRate: { type: Number, default: 0, min: 0 },
    vatAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },

    sourceQuoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", default: null }
  },
  { timestamps: true }
);

InvoiceSchema.index({ companyId: 1, invoiceNo: 1 }, { unique: true });
InvoiceSchema.index({ projectId: 1, issueDate: -1 });
InvoiceSchema.index({ dueDate: 1 });

module.exports = mongoose.model("Invoice", InvoiceSchema);
