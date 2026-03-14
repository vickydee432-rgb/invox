const mongoose = require("mongoose");

const AllowanceSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    amount: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const DeductionSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    amount: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const SalaryStructureSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    baseSalary: { type: Number, required: true, min: 0 },
    allowances: { type: [AllowanceSchema], default: [] },
    deductions: { type: [DeductionSchema], default: [] }
  },
  { timestamps: true }
);

SalaryStructureSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model("SalaryStructure", SalaryStructureSchema);
