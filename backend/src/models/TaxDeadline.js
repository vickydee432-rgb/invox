const mongoose = require("mongoose");

const TaxDeadlineSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, trim: true, index: true },
    taxType: {
      type: String,
      required: true,
      trim: true,
      enum: ["income_annual", "provisional", "paye", "vat", "wht", "turnover", "custom"],
      index: true
    },
    title: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true, index: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    notifyDaysBefore: { type: [Number], default: [] },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false }
    },
    status: { type: String, enum: ["pending", "filed", "paid", "skipped"], default: "pending", index: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

TaxDeadlineSchema.index({ companyId: 1, taxType: 1, dueDate: 1 }, { unique: true });
TaxDeadlineSchema.index({ companyId: 1, workspaceId: 1, dueDate: 1 });

module.exports = mongoose.model("TaxDeadline", TaxDeadlineSchema);

