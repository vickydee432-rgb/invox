const mongoose = require("mongoose");

const PayslipSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    payrunId: { type: mongoose.Schema.Types.ObjectId, ref: "Payrun", required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    gross: { type: Number, required: true, min: 0 },
    net: { type: Number, required: true, min: 0 },
    taxes: { type: Array, default: [] },
    deductions: { type: Array, default: [] },
    allowances: { type: Array, default: [] }
  },
  { timestamps: true }
);

PayslipSchema.index({ companyId: 1, payrunId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model("Payslip", PayslipSchema);
