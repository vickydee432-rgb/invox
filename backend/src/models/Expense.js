const mongoose = require("mongoose");

const ReceiptSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    note: { type: String, trim: true }
  },
  { _id: false }
);

const ExpenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true }, // Supplies, Utilities, Labor, etc
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },

    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    projectLabel: { type: String, trim: true },

    supplier: { type: String, trim: true },
    paidTo: { type: String, trim: true }, // phone or name
    paymentMethod: { type: String, trim: true }, // cash, bank, airtel, mtn, pos
    note: { type: String, trim: true },

    receipts: { type: [ReceiptSchema], default: [] }
  },
  { timestamps: true }
);

ExpenseSchema.index({ projectId: 1, date: -1 });
ExpenseSchema.index({ category: 1, date: -1 });

module.exports = mongoose.model("Expense", ExpenseSchema);
