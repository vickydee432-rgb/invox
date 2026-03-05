const express = require("express");
const { z } = require("zod");
const Expense = require("../models/Expense");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const ChangeLog = require("../models/ChangeLog");
const SyncIdMap = require("../models/SyncIdMap");
const SyncOp = require("../models/SyncOp");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { handleRouteError } = require("./_helpers");

const router = express.Router();
router.use(requireAuth, requireSubscription);

const ENTITY_MODELS = {
  expense: Expense,
  invoice: Invoice,
  product: Product,
  inventory_movement: StockMovement,
  stock_movement: StockMovement
};

const PushSchema = z.object({
  deviceId: z.string().min(1),
  workspaceId: z.string().optional(),
  items: z.array(
    z.object({
      queueId: z.string().min(1),
      idempotencyKey: z.string().min(1),
      entityType: z.string().min(1),
      operation: z.enum(["create", "update", "delete"]),
      recordId: z.string().min(1),
      serverId: z.string().optional(),
      version: z.number().optional(),
      payload: z.any().optional()
    })
  )
});

function stripSystemFields(payload = {}) {
  const next = { ...payload };
  delete next._id;
  delete next.companyId;
  delete next.company_id;
  delete next.workspaceId;
  delete next.workspace_id;
  delete next.userId;
  delete next.user_id;
  delete next.deviceId;
  delete next.device_id;
  delete next.version;
  delete next.deletedAt;
  delete next.deleted_at;
  delete next.createdAt;
  delete next.updatedAt;
  return next;
}

async function logChange({ companyId, workspaceId, userId, deviceId, entityType, recordId, operation, version, payload, idempotencyKey }) {
  await ChangeLog.create({
    companyId,
    workspaceId,
    userId,
    deviceId,
    entityType,
    recordId,
    operation,
    version,
    payload,
    idempotencyKey,
    changedAt: new Date()
  });
}

router.post("/push", async (req, res) => {
  try {
    const parsed = PushSchema.parse(req.body);
    const companyId = req.user.companyId;
    const workspaceId = parsed.workspaceId || String(companyId);
    const userId = req.user._id;
    const deviceId = parsed.deviceId;

    const results = [];
    const conflicts = [];

    for (const item of parsed.items) {
      const existingOp = await SyncOp.findOne({ companyId, idempotencyKey: item.idempotencyKey }).lean();
      if (existingOp) {
        results.push(existingOp.result);
        continue;
      }

      const Model = ENTITY_MODELS[item.entityType];
      if (!Model) {
        const result = { queueId: item.queueId, status: "failed", error: "Unsupported entity type" };
        await SyncOp.create({ companyId, idempotencyKey: item.idempotencyKey, status: "failed", result });
        results.push(result);
        continue;
      }

      let serverId = item.serverId;
      if (!serverId) {
        const map = await SyncIdMap.findOne({
          companyId,
          workspaceId,
          entityType: item.entityType,
          localId: item.recordId
        }).lean();
        serverId = map?.serverId;
      }

      if (item.operation === "create") {
        const payload = stripSystemFields(item.payload);
        const created = await Model.create({
          ...payload,
          companyId,
          workspaceId,
          userId,
          deviceId,
          version: 1,
          deletedAt: null
        });
        serverId = created._id.toString();
        await SyncIdMap.updateOne(
          { companyId, workspaceId, entityType: item.entityType, localId: item.recordId },
          { $setOnInsert: { serverId } },
          { upsert: true }
        );
        const payloadOut = created.toObject();
        await logChange({
          companyId,
          workspaceId,
          userId,
          deviceId,
          entityType: item.entityType,
          recordId: serverId,
          operation: "create",
          version: created.version || 1,
          payload: payloadOut,
          idempotencyKey: item.idempotencyKey
        });
        const result = { queueId: item.queueId, status: "ok", serverId, newVersion: created.version || 1 };
        await SyncOp.create({ companyId, idempotencyKey: item.idempotencyKey, status: "ok", result });
        results.push(result);
        continue;
      }

      if (!serverId) {
        const result = { queueId: item.queueId, status: "failed", error: "Missing server id" };
        await SyncOp.create({ companyId, idempotencyKey: item.idempotencyKey, status: "failed", result });
        results.push(result);
        continue;
      }

      const doc = await Model.findOne({ _id: serverId, companyId });
      if (!doc) {
        const result = { queueId: item.queueId, status: "failed", error: "Record not found" };
        await SyncOp.create({ companyId, idempotencyKey: item.idempotencyKey, status: "failed", result });
        results.push(result);
        continue;
      }

      const currentVersion = doc.version || 1;
      if (item.version !== undefined && item.version < currentVersion) {
        conflicts.push({
          queueId: item.queueId,
          recordId: serverId,
          serverVersion: currentVersion,
          serverPayload: doc.toObject()
        });
        const result = { queueId: item.queueId, status: "conflict", serverId };
        await SyncOp.create({ companyId, idempotencyKey: item.idempotencyKey, status: "conflict", result });
        results.push(result);
        continue;
      }

      if (item.operation === "delete") {
        doc.deletedAt = new Date();
      } else {
        const payload = stripSystemFields(item.payload);
        Object.entries(payload).forEach(([key, value]) => {
          doc[key] = value;
        });
      }
      doc.workspaceId = workspaceId;
      doc.userId = userId;
      doc.deviceId = deviceId;
      doc.version = currentVersion + 1;
      await doc.save();

      const payloadOut = doc.toObject();
      await logChange({
        companyId,
        workspaceId,
        userId,
        deviceId,
        entityType: item.entityType,
        recordId: serverId,
        operation: item.operation,
        version: doc.version || currentVersion + 1,
        payload: payloadOut,
        idempotencyKey: item.idempotencyKey
      });

      const result = { queueId: item.queueId, status: "ok", serverId, newVersion: doc.version };
      await SyncOp.create({ companyId, idempotencyKey: item.idempotencyKey, status: "ok", result });
      results.push(result);
    }

    res.json({ results, conflicts });
  } catch (err) {
    return handleRouteError(res, err, "Failed to sync push");
  }
});

router.get("/pull", async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const workspaceId = String(req.query.workspaceId || companyId);
    const sinceRaw = req.query.since ? String(req.query.since) : null;
    let since = sinceRaw ? new Date(sinceRaw) : new Date(0);
    if (Number.isNaN(since.getTime())) since = new Date(0);
    const logs = await ChangeLog.find({
      companyId,
      workspaceId,
      changedAt: { $gt: since }
    })
      .sort({ changedAt: 1 })
      .limit(2000)
      .lean();
    res.json({
      changes: logs.map((log) => ({
        entityType: log.entityType,
        operation: log.operation,
        recordId: log.recordId,
        version: log.version,
        payload: log.payload
      })),
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to sync pull");
  }
});

module.exports = router;
