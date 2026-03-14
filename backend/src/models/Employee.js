const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    idNumber: { type: String, trim: true },
    taxNumber: { type: String, trim: true },
    department: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    startDate: { type: Date },
    endDate: { type: Date }
  },
  { timestamps: true }
);

EmployeeSchema.index({ companyId: 1, lastName: 1, firstName: 1 });

module.exports = mongoose.model("Employee", EmployeeSchema);
