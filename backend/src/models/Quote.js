const mongoose = require("mongoose");

const QuoteItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 }, // absolute discount per line
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const QuoteSchema = new mongoose.Schema(
  {
    quoteNo: { type: String, required: true, unique: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    projectLabel: { type: String, trim: true }, // fallback label if no projectId
    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "declined", "expired"],
      default: "draft",
      index: true
    },
    issueDate: { type: Date, default: () => new Date() },
    validUntil: { type: Date, required: true },

    items: { type: [QuoteItemSchema], default: [] },

    subtotal: { type: Number, required: true, min: 0 },
    vatRate: { type: Number, default: 0, min: 0 }, // e.g. 16 for 16%
    vatAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    notes: { type: String, trim: true },
    terms: { type: String, trim: true },

    convertedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null }
  },
  { timestamps: true }
);

QuoteSchema.index({ projectId: 1, issueDate: -1 });
QuoteSchema.index({ validUntil: 1 });

module.exports = mongoose.model("Quote", QuoteSchema);
