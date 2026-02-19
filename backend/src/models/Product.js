const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
    unit: { type: String, trim: true }, // e.g. bag, pcs, litre
    costPrice: { type: Number, default: 0, min: 0 },
    salePrice: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ProductSchema.index({ companyId: 1, sku: 1 }, { unique: true, sparse: true });
ProductSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model("Product", ProductSchema);
