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
  barcode: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  costPrice: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  isActive: z.boolean().optional()
});

router.get("/lookup", async (req, res) => {
  try {
    const barcode = String(req.query.barcode || "").trim();
    if (!barcode) return res.status(400).json({ error: "barcode is required" });
    const product = await Product.findOne({ companyId: req.user.companyId, barcode }).lean();
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ product });
  } catch (err) {
    return handleRouteError(res, err, "Failed to lookup product");
  }
});

router.get("/", async (req, res) => {
  try {
    const { q, search } = req.query;
    const term = String(search || q || "").trim();
    const filter = { companyId: req.user.companyId };
    if (term) {
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { sku: { $regex: term, $options: "i" } },
        { barcode: { $regex: term, $options: "i" } }
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
      barcode: parsed.barcode,
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
    if (err?.code === 11000 && err?.keyPattern?.barcode) {
      return res.status(409).json({ error: "Barcode already used by another product" });
    }
    if (err?.code === 11000 && err?.keyPattern?.sku) {
      return res.status(409).json({ error: "SKU already used by another product" });
    }
    return handleRouteError(res, err, "Failed to create product");
  }
});

const updateProductHandler = async (req, res) => {
  try {
    ensureObjectId(req.params.id, "product id");
    const parsed = ProductSchema.parse(req.body);
    const product = await Product.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!product) return res.status(404).json({ error: "Product not found" });
    product.name = parsed.name ?? product.name;
    product.sku = parsed.sku ?? product.sku;
    product.barcode = parsed.barcode ?? product.barcode;
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
    if (err?.code === 11000 && err?.keyPattern?.barcode) {
      return res.status(409).json({ error: "Barcode already used by another product" });
    }
    if (err?.code === 11000 && err?.keyPattern?.sku) {
      return res.status(409).json({ error: "SKU already used by another product" });
    }
    return handleRouteError(res, err, "Failed to update product");
  }
};

router.put("/:id", updateProductHandler);
router.patch("/:id", updateProductHandler);

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
