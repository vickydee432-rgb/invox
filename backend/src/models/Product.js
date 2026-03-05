const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    deviceId: { type: String, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
    unit: { type: String, trim: true }, // e.g. bag, pcs, litre
    costPrice: { type: Number, default: 0, min: 0 },
    salePrice: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

ProductSchema.index({ companyId: 1, sku: 1 }, { unique: true, sparse: true });
ProductSchema.index({ companyId: 1, barcode: 1 }, { unique: true, sparse: true });
ProductSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model("Product", ProductSchema);
