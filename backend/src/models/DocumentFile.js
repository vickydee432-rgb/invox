const mongoose = require("mongoose");

const DocumentFileSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    mime: { type: String, trim: true },
    size: { type: Number, default: 0 },
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
);

DocumentFileSchema.index({ companyId: 1, fileName: 1 });

module.exports = mongoose.model("DocumentFile", DocumentFileSchema);
