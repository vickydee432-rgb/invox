const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../../middleware/auth");
const ZraConnection = require("../../models/ZraConnection");
const { encryptJson } = require("../../services/zra/crypto");
const { syncConnection } = require("../../services/zra/sync");
const { handleRouteError } = require("../_helpers");

const router = express.Router();
router.use(requireAuth);

const ConnectSchema = z.object({
  tpin: z.string().min(1),
  branchId: z.string().min(1),
  branchName: z.string().optional(),
  baseUrl: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  syncIntervalMinutes: z.number().min(1).max(60).optional(),
  credentials: z.record(z.any()).refine((value) => Object.keys(value || {}).length > 0, {
    message: "credentials required"
  })
});

const DisconnectSchema = z.object({
  branchId: z.string().min(1)
});

const ManualSyncSchema = z.object({
  branchId: z.string().optional()
});

function sanitizeConnection(connection) {
  return {
    id: connection._id,
    tpin: connection.tpin,
    branchId: connection.branchId,
    branchName: connection.branchName,
    enabled: connection.enabled,
    syncEnabled: connection.syncEnabled,
    syncIntervalMinutes: connection.syncIntervalMinutes,
    baseUrl: connection.baseUrl,
    lastSyncAt: connection.lastSyncAt,
    lastSyncStatus: connection.lastSyncStatus,
    lastSyncError: connection.lastSyncError,
    failureCount: connection.failureCount,
    backoffUntil: connection.backoffUntil
  };
}

router.post("/connect", async (req, res) => {
  try {
    const parsed = ConnectSchema.parse(req.body);
    const encrypted = encryptJson(parsed.credentials);
    const update = {
      companyId: req.user.companyId,
      tpin: parsed.tpin,
      branchId: parsed.branchId,
      branchName: parsed.branchName,
      baseUrl: parsed.baseUrl,
      enabled: true,
      syncEnabled: parsed.syncEnabled ?? true,
      syncIntervalMinutes: parsed.syncIntervalMinutes || 5,
      credentials: encrypted
    };

    const connection = await ZraConnection.findOneAndUpdate(
      { companyId: req.user.companyId, branchId: parsed.branchId },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ connection: sanitizeConnection(connection) });
  } catch (err) {
    return handleRouteError(res, err, "Failed to connect ZRA");
  }
});

router.post("/disconnect", async (req, res) => {
  try {
    const parsed = DisconnectSchema.parse(req.body);
    const connection = await ZraConnection.findOneAndUpdate(
      { companyId: req.user.companyId, branchId: parsed.branchId },
      { $set: { enabled: false, syncEnabled: false } },
      { new: true }
    );
    if (!connection) return res.status(404).json({ error: "Connection not found" });
    res.json({ connection: sanitizeConnection(connection) });
  } catch (err) {
    return handleRouteError(res, err, "Failed to disconnect ZRA");
  }
});

router.post("/sync/manual", async (req, res) => {
  try {
    const parsed = ManualSyncSchema.parse(req.body || {});
    if (parsed.branchId) {
      const connection = await ZraConnection.findOne({
        companyId: req.user.companyId,
        branchId: parsed.branchId
      });
      if (!connection) return res.status(404).json({ error: "Connection not found" });
      await syncConnection(connection);
      connection.lastSyncAt = new Date();
      connection.lastSyncStatus = "ok";
      connection.lastSyncError = "";
      connection.failureCount = 0;
      connection.backoffUntil = null;
      await connection.save();
      return res.json({ ok: true });
    }

    const connections = await ZraConnection.find({ companyId: req.user.companyId, enabled: true });
    for (const connection of connections) {
      await syncConnection(connection);
      connection.lastSyncAt = new Date();
      connection.lastSyncStatus = "ok";
      connection.lastSyncError = "";
      connection.failureCount = 0;
      connection.backoffUntil = null;
      await connection.save();
    }
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to sync ZRA" );
  }
});

router.get("/status", async (req, res) => {
  try {
    const connections = await ZraConnection.find({ companyId: req.user.companyId }).sort({ createdAt: -1 });
    res.json({ connections: connections.map(sanitizeConnection) });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load ZRA status");
  }
});

module.exports = router;
