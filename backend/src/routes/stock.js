const express = require("express");
const { z } = require("zod");
const Stock = require("../models/Stock");
const StockMovement = require("../models/StockMovement");
const InventoryLog = require("../models/InventoryLog");
const { ensureObjectId, handleRouteError, parseLimit, parsePage } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("inventory"));

router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = { companyId: req.user.companyId };
    if (branchId) {
      ensureObjectId(branchId, "branch id");
      filter.branchId = branchId;
    }
    const stocks = await Stock.find(filter)
      .populate("productId", "name sku reorderLevel costPrice salePrice")
      .populate("branchId", "name code")
      .sort({ updatedAt: -1 })
      .lean();

    const stock = stocks.map((row) => {
      const reorderLevel = Number(row.productId?.reorderLevel || 0);
      const onHand = Number(row.onHand || 0);
      return {
        ...row,
        product: row.productId,
        branch: row.branchId,
        lowStock: reorderLevel > 0 && onHand <= reorderLevel
      };
    });

    res.json({ stock });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list stock");
  }
});

const MovementQuerySchema = z.object({
  branchId: z.string().optional(),
  productId: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

router.get("/movements", async (req, res) => {
  try {
    const parsed = MovementQuerySchema.parse(req.query);
    const filter = { companyId: req.user.companyId };
    if (parsed.branchId) {
      ensureObjectId(parsed.branchId, "branch id");
      filter.branchId = parsed.branchId;
    }
    if (parsed.productId) {
      ensureObjectId(parsed.productId, "product id");
      filter.productId = parsed.productId;
    }
    const safeLimit = parseLimit(parsed.limit, { defaultLimit: 50, maxLimit: 200 });
    const page = parsePage(parsed.page);
    const skip = (page - 1) * safeLimit;
    const total = await StockMovement.countDocuments(filter);
    const movements = await StockMovement.find(filter)
      .populate("productId", "name sku")
      .populate("branchId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ movements, page, pages, total, count: movements.length });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list movements");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "stock id");
    const stock = await Stock.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!stock) return res.status(404).json({ error: "Stock not found" });
    const previousQty = Number(stock.onHand || 0);

    if (previousQty !== 0) {
      await StockMovement.create({
        companyId: req.user.companyId,
        branchId: stock.branchId,
        productId: stock.productId,
        type: "delete",
        qty: -previousQty,
        unitCost: Number(stock.avgCost || 0),
        totalCost: Number(stock.avgCost || 0) * Math.abs(previousQty),
        sourceType: "stock_delete",
        note: "Stock record deleted"
      });

      await InventoryLog.create({
        companyId: req.user.companyId,
        productId: stock.productId,
        branchId: stock.branchId,
        userId: req.user._id,
        change: -previousQty,
        previousQty,
        newQty: 0,
        reason: "delete",
        note: "Stock record deleted"
      });
    }

    await stock.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete stock record");
  }
});

module.exports = router;
