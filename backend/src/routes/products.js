const express = require("express");
const { z } = require("zod");
const Product = require("../models/Product");
const { ensureObjectId, handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("inventory"));

const ProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  costPrice: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  isActive: z.boolean().optional()
});

router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    const filter = { companyId: req.user.companyId };
    if (q) {
      filter.$or = [
        { name: { $regex: String(q), $options: "i" } },
        { sku: { $regex: String(q), $options: "i" } }
      ];
    }
    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ products });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list products");
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = ProductSchema.parse(req.body);
    const product = await Product.create({
      companyId: req.user.companyId,
      name: parsed.name,
      sku: parsed.sku,
      description: parsed.description,
      category: parsed.category,
      unit: parsed.unit,
      costPrice: parsed.costPrice ?? 0,
      salePrice: parsed.salePrice ?? 0,
      reorderLevel: parsed.reorderLevel ?? 0,
      isActive: parsed.isActive ?? true
    });
    res.status(201).json({ product });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create product");
  }
});

router.put("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "product id");
    const parsed = ProductSchema.parse(req.body);
    const product = await Product.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!product) return res.status(404).json({ error: "Product not found" });
    product.name = parsed.name ?? product.name;
    product.sku = parsed.sku ?? product.sku;
    product.description = parsed.description ?? product.description;
    product.category = parsed.category ?? product.category;
    product.unit = parsed.unit ?? product.unit;
    if (parsed.costPrice !== undefined) product.costPrice = parsed.costPrice;
    if (parsed.salePrice !== undefined) product.salePrice = parsed.salePrice;
    if (parsed.reorderLevel !== undefined) product.reorderLevel = parsed.reorderLevel;
    if (parsed.isActive !== undefined) product.isActive = parsed.isActive;
    await product.save();
    res.json({ product });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update product");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "product id");
    const product = await Product.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!product) return res.status(404).json({ error: "Product not found" });
    product.isActive = false;
    await product.save();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete product");
  }
});

module.exports = router;
