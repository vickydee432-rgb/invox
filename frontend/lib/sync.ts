"use client";

import Dexie from "dexie";
import { apiFetch } from "@/lib/api";
import { BaseRecord, getDb, SyncQueueItem, SyncState } from "@/lib/db";
import { getDeviceId } from "@/lib/device";

type SyncContext = {
  companyId: string;
  workspaceId: string;
  userId: string;
};

type PushResult = {
  queueId: string;
  status: "ok" | "failed" | "conflict";
  serverId?: string;
  newVersion?: number;
  error?: string;
};

type PullChange = {
  entityType: string;
  operation: "create" | "update" | "delete";
  recordId: string;
  version?: number;
  payload?: any;
};

let engineStarted = false;
let stopHandler: (() => void) | null = null;

const ENTITY_TABLE: Record<string, string> = {
  invoice: "invoices",
  invoice_item: "invoice_items",
  product: "products",
  inventory_movement: "inventory_movements",
  customer: "customers",
  expense: "expenses",
  payment: "payments",
  settings: "settings"
};

export async function startSyncEngine(context: SyncContext) {
  if (engineStarted) return stopHandler;
  engineStarted = true;

  const deviceId = getDeviceId();
  const db = getDb(context.companyId, deviceId);
  await ensureSyncState(db, context);

  let running = true;

  const run = async () => {
    if (!running) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      await pushQueue(db, context, deviceId);
      await pullChanges(db, context, deviceId);
    } catch (err) {
      // keep background sync resilient
    }
  };

  const interval = window.setInterval(run, 15000);
  const onOnline = () => run();
  window.addEventListener("online", onOnline);
  run();

  stopHandler = () => {
    running = false;
    window.clearInterval(interval);
    window.removeEventListener("online", onOnline);
  };
  return stopHandler;
}

type EnqueueInput = {
  entityType: string;
  operation: "create" | "update" | "delete";
  recordId: string;
  serverId?: string | null;
  payload: any;
};

export async function enqueueChange(context: SyncContext, input: EnqueueInput) {
  const deviceId = getDeviceId();
  const db = getDb(context.companyId, deviceId);
  const now = new Date().toISOString();
  const queueItem: SyncQueueItem = {
    queueId: crypto.randomUUID(),
    companyId: context.companyId,
    workspaceId: context.workspaceId,
    userId: context.userId,
    deviceId,
    entityType: input.entityType,
    operation: input.operation,
    recordId: input.recordId,
    serverId: input.serverId ?? null,
    payload: input.payload,
    timestamp: now,
    retryCount: 0,
    status: "pending",
    idempotencyKey: crypto.randomUUID()
  };
  await db.sync_queue.put(queueItem);
  return queueItem;
}

async function ensureSyncState(db: ReturnType<typeof getDb>, context: SyncContext) {
  const existing = await db.sync_state.get("state");
  if (existing) return;
  const state: SyncState = {
    id: "state",
    companyId: context.companyId,
    workspaceId: context.workspaceId,
    lastPullAt: undefined,
    lastPushAt: undefined
  };
  await db.sync_state.put(state);
}

function shouldRetry(item: SyncQueueItem) {
  if (item.status !== "failed") return true;
  const backoffMs = Math.min(5 * 60 * 1000, Math.pow(2, item.retryCount) * 1000);
  if (!item.lastAttemptAt) return true;
  const nextAt = new Date(item.lastAttemptAt).getTime() + backoffMs;
  return Date.now() >= nextAt;
}

async function pushQueue(db: ReturnType<typeof getDb>, context: SyncContext, deviceId: string) {
  const pending = await db.sync_queue
    .filter((item) => (item.status === "pending" || item.status === "failed") && shouldRetry(item))
    .sortBy("timestamp");

  if (pending.length === 0) return;

  const batch = pending.slice(0, 100);
  const now = new Date().toISOString();
  await db.sync_queue.bulkPut(
    batch.map((item) => ({
      ...item,
      status: "syncing" as const,
      lastAttemptAt: now
    }))
  );

  try {
    const response = await apiFetch<{ results: PushResult[] }>("/api/sync/push", {
      method: "POST",
      body: JSON.stringify({
        deviceId,
        workspaceId: context.workspaceId,
        items: batch.map((item) => ({
          queueId: item.queueId,
          idempotencyKey: item.idempotencyKey,
          entityType: item.entityType,
          operation: item.operation,
          recordId: item.recordId,
          serverId: item.serverId ?? undefined,
          payload: item.payload,
          version: item.payload?.version
        }))
      })
    });

    const resultMap = new Map(response.results.map((res) => [res.queueId, res]));
    const updates: SyncQueueItem[] = [];

    for (const item of batch) {
      const result = resultMap.get(item.queueId);
      if (!result) {
        updates.push({
          ...item,
          status: "failed",
          retryCount: item.retryCount + 1
        });
        continue;
      }

      if (result.status === "ok") {
        if (result.serverId) {
          await db.id_map.put({
            id: crypto.randomUUID(),
            companyId: context.companyId,
            workspaceId: context.workspaceId,
            entityType: item.entityType,
            localId: item.recordId,
            serverId: result.serverId
          });
          await upsertServerId(db, item.entityType, item.recordId, result.serverId);
        }
        updates.push({ ...item, status: "done" });
      } else if (result.status === "conflict") {
        updates.push({ ...item, status: "conflict" });
      } else {
        updates.push({
          ...item,
          status: "failed",
          retryCount: item.retryCount + 1
        });
      }
    }

    await db.sync_queue.bulkPut(updates);
    const prevState = await db.sync_state.get("state");
    await db.sync_state.put({
      id: "state",
      companyId: context.companyId,
      workspaceId: context.workspaceId,
      lastPullAt: prevState?.lastPullAt,
      lastPushAt: new Date().toISOString()
    });
  } catch (err) {
    await db.sync_queue.bulkPut(
      batch.map((item) => ({
        ...item,
        status: "failed" as const,
        retryCount: item.retryCount + 1
      }))
    );
  }
}

async function pullChanges(db: ReturnType<typeof getDb>, context: SyncContext, deviceId: string) {
  const state = await db.sync_state.get("state");
  const since = state?.lastPullAt || null;
  const data = await apiFetch<{ changes: PullChange[]; serverTime: string }>(
    `/api/sync/pull?since=${encodeURIComponent(since || "")}&workspaceId=${encodeURIComponent(
      context.workspaceId
    )}`
  );

  for (const change of data.changes || []) {
    await applyRemoteChange(db, context, change);
  }

  const prevState = await db.sync_state.get("state");
  await db.sync_state.put({
    id: "state",
    companyId: context.companyId,
    workspaceId: context.workspaceId,
    lastPullAt: data.serverTime || new Date().toISOString(),
    lastPushAt: prevState?.lastPushAt
  });
}

async function applyRemoteChange(db: ReturnType<typeof getDb>, context: SyncContext, change: PullChange) {
  const tableName = ENTITY_TABLE[change.entityType];
  if (!tableName) return;
  const table = (db as any)[tableName] as Dexie.Table<BaseRecord, string>;
  if (!table) return;

  let localId = change.recordId;
  const map = await db.id_map
    .where({ companyId: context.companyId, workspaceId: context.workspaceId, entityType: change.entityType })
    .filter((row) => row.serverId === change.recordId)
    .first();
  if (map?.localId) localId = map.localId;

  if (change.operation === "delete") {
    const existing = await table.get(localId);
    if (!existing) return;
    await table.put({
      ...existing,
      deletedAt: change.payload?.deletedAt || new Date().toISOString(),
      version: change.version || existing.version
    });
    return;
  }

  const payload = { ...(change.payload || {}) };
  delete payload._id;
  delete payload.__v;
  const now = new Date().toISOString();
  await table.put({
    id: localId,
    serverId: change.recordId,
    companyId: context.companyId,
    workspaceId: context.workspaceId,
    userId: payload.userId || context.userId,
    deviceId: payload.deviceId || getDeviceId(),
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
    deletedAt: payload.deletedAt || null,
    version: change.version || payload.version || 1,
    ...payload
  });
}

async function upsertServerId(db: ReturnType<typeof getDb>, entityType: string, localId: string, serverId: string) {
  const tableName = ENTITY_TABLE[entityType];
  if (!tableName) return;
  const table = (db as any)[tableName] as Dexie.Table<BaseRecord, string>;
  const existing = await table.get(localId);
  if (!existing) return;
  await table.put({ ...existing, serverId });
}
