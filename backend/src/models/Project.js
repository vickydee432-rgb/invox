const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. SHANTUMBU, PUMA NDOLA
    description: { type: String, trim: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ProjectSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Project", ProjectSchema);
