const express = require("express");
const { z } = require("zod");
const Product = require("../models/Product");
const Stock = require("../models/Stock");
const StockMovement = require("../models/StockMovement");
const StockTransfer = require("../models/StockTransfer");
const Branch = require("../models/Branch");
const InventoryLog = require("../models/InventoryLog");
const { ensureObjectId, handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("inventory"));

const AdjustSchema = z.object({
  productId: z.string().min(1),
  change: z.number(),
  reason: z.string().min(1),
  note: z.string().optional(),
  branchId: z.string().optional()
});

const TransferSchema = z.object({
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().positive()
      })
    )
    .min(1),
  note: z.string().optional()
});

async function resolveBranch(companyId, branchId) {
  if (branchId) {
    ensureObjectId(branchId, "branch id");
    return Branch.findOne({ _id: branchId, companyId });
  }
  return Branch.findOne({ companyId, isDefault: true }) || Branch.findOne({ companyId });
}

router.post("/adjust", async (req, res) => {
  try {
    const parsed = AdjustSchema.parse(req.body || {});
    ensureObjectId(parsed.productId, "product id");

    const product = await Product.findOne({ _id: parsed.productId, companyId: req.user.companyId });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const branch = await resolveBranch(req.user.companyId, parsed.branchId);
    if (!branch) return res.status(400).json({ error: "Branch not found" });

    const change = Number(parsed.change);
    if (!Number.isFinite(change) || change === 0) {
      return res.status(400).json({ error: "Change must be a non-zero number" });
    }

    let stock = await Stock.findOne({
      companyId: req.user.companyId,
      branchId: branch._id,
      productId: product._id
    });
    if (!stock) {
      stock = await Stock.create({
        companyId: req.user.companyId,
        branchId: branch._id,
        productId: product._id,
        onHand: 0,
        avgCost: Number(product.costPrice || 0)
      });
    }

    const previousQty = Number(stock.onHand || 0);
    const newQty = previousQty + change;
    stock.onHand = newQty;
    if (change > 0 && product.costPrice) {
      stock.avgCost = Number(product.costPrice || stock.avgCost || 0);
    }
    await stock.save();

    await StockMovement.create({
      companyId: req.user.companyId,
      branchId: branch._id,
      productId: product._id,
      type: "adjustment",
      qty: change,
      unitCost: Number(product.costPrice || 0),
      totalCost: Number(product.costPrice || 0) * change,
      sourceType: "inventory_adjust",
      note: parsed.note
    });

    await InventoryLog.create({
      companyId: req.user.companyId,
      productId: product._id,
      branchId: branch._id,
      userId: req.user._id,
      change,
      previousQty,
      newQty,
      reason: parsed.reason,
      note: parsed.note
    });

    res.json({
      ok: true,
      stock: {
        productId: product._id,
        branchId: branch._id,
        previousQty,
        newQty
      }
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to adjust inventory");
  }
});

router.post("/transfer", async (req, res) => {
  try {
    const parsed = TransferSchema.parse(req.body || {});
    ensureObjectId(parsed.fromBranchId, "from branch id");
    ensureObjectId(parsed.toBranchId, "to branch id");
    if (parsed.fromBranchId === parsed.toBranchId) {
      return res.status(400).json({ error: "Transfer branches must be different" });
    }

    const [fromBranch, toBranch] = await Promise.all([
      Branch.findOne({ _id: parsed.fromBranchId, companyId: req.user.companyId }),
      Branch.findOne({ _id: parsed.toBranchId, companyId: req.user.companyId })
    ]);
    if (!fromBranch || !toBranch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    for (const item of parsed.items) {
      ensureObjectId(item.productId, "product id");
      const product = await Product.findOne({ _id: item.productId, companyId: req.user.companyId });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      const fromStock =
        (await Stock.findOne({ companyId: req.user.companyId, branchId: fromBranch._id, productId: product._id })) ||
        (await Stock.create({
          companyId: req.user.companyId,
          branchId: fromBranch._id,
          productId: product._id,
          onHand: 0,
          avgCost: Number(product.costPrice || 0)
        }));
      if (Number(fromStock.onHand || 0) < item.qty) {
        return res.status(409).json({ error: "Insufficient stock for transfer", productId: product._id });
      }
      fromStock.onHand = Number(fromStock.onHand || 0) - item.qty;
      await fromStock.save();

      const toStock =
        (await Stock.findOne({ companyId: req.user.companyId, branchId: toBranch._id, productId: product._id })) ||
        (await Stock.create({
          companyId: req.user.companyId,
          branchId: toBranch._id,
          productId: product._id,
          onHand: 0,
          avgCost: Number(product.costPrice || 0)
        }));
      toStock.onHand = Number(toStock.onHand || 0) + item.qty;
      if (product.costPrice) {
        toStock.avgCost = Number(product.costPrice || toStock.avgCost || 0);
      }
      await toStock.save();

      await StockMovement.create({
        companyId: req.user.companyId,
        branchId: fromBranch._id,
        productId: product._id,
        type: "transfer_out",
        qty: -item.qty,
        unitCost: Number(product.costPrice || 0),
        totalCost: Number(product.costPrice || 0) * item.qty,
        sourceType: "inventory_transfer",
        note: parsed.note
      });

      await StockMovement.create({
        companyId: req.user.companyId,
        branchId: toBranch._id,
        productId: product._id,
        type: "transfer_in",
        qty: item.qty,
        unitCost: Number(product.costPrice || 0),
        totalCost: Number(product.costPrice || 0) * item.qty,
        sourceType: "inventory_transfer",
        note: parsed.note
      });
    }

    const transfer = await StockTransfer.create({
      companyId: req.user.companyId,
      fromWarehouseId: fromBranch._id,
      toWarehouseId: toBranch._id,
      date: new Date(),
      notes: parsed.note,
      items: parsed.items
    });

    res.status(201).json({ transfer });
  } catch (err) {
    return handleRouteError(res, err, "Failed to transfer stock");
  }
});

module.exports = router;
