const mongoose = require("mongoose");

const DocumentLinkSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "DocumentFile", required: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true }
  },
  { timestamps: true }
);

DocumentLinkSchema.index({ companyId: 1, entityType: 1, entityId: 1 });

module.exports = mongoose.model("DocumentLink", DocumentLinkSchema);
