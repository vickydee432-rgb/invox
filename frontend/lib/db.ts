"use client";

import Dexie, { Table } from "dexie";

export type BaseRecord = {
  id: string;
  serverId?: string | null;
  companyId: string;
  workspaceId: string;
  userId: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version: number;
};

export type SyncQueueItem = {
  queueId: string;
  companyId: string;
  workspaceId: string;
  userId: string;
  deviceId: string;
  entityType: string;
  operation: "create" | "update" | "delete";
  recordId: string;
  serverId?: string | null;
  payload: any;
  timestamp: string;
  lastAttemptAt?: string;
  retryCount: number;
  status: "pending" | "syncing" | "failed" | "done" | "conflict";
  idempotencyKey: string;
};

export type SyncState = {
  id: string;
  companyId: string;
  workspaceId: string;
  lastPullAt?: string;
  lastPushAt?: string;
};

export type IdMap = {
  id: string;
  companyId: string;
  workspaceId: string;
  entityType: string;
  localId: string;
  serverId: string;
};

export class InvoxDB extends Dexie {
  invoices!: Table<BaseRecord>;
  invoice_items!: Table<BaseRecord>;
  products!: Table<BaseRecord>;
  inventory_movements!: Table<BaseRecord>;
  customers!: Table<BaseRecord>;
  expenses!: Table<BaseRecord>;
  payments!: Table<BaseRecord>;
  settings!: Table<BaseRecord>;
  sync_queue!: Table<SyncQueueItem>;
  sync_state!: Table<SyncState>;
  id_map!: Table<IdMap>;
  audit_log!: Table<BaseRecord>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      invoices: "id, serverId, companyId, workspaceId, updatedAt, deletedAt, invoiceNo",
      invoice_items: "id, invoiceId, companyId, workspaceId",
      products: "id, serverId, companyId, workspaceId, updatedAt, deletedAt, sku, barcode, name",
      inventory_movements: "id, serverId, companyId, workspaceId, updatedAt, deletedAt, productId",
      customers: "id, serverId, companyId, workspaceId, updatedAt, deletedAt, email, name",
      expenses: "id, serverId, companyId, workspaceId, updatedAt, deletedAt, date, category",
      payments: "id, serverId, companyId, workspaceId, updatedAt, deletedAt, invoiceId",
      settings: "id, companyId, workspaceId, updatedAt, key",
      sync_queue: "queueId, status, timestamp, companyId, workspaceId, entityType",
      sync_state: "id, companyId, workspaceId",
      id_map: "id, companyId, workspaceId, entityType, localId, serverId",
      audit_log: "id, companyId, workspaceId, createdAt"
    });
  }
}

const dbCache = new Map<string, InvoxDB>();

export function getDb(companyId: string, deviceId: string) {
  const key = `${companyId}:${deviceId}`;
  const cached = dbCache.get(key);
  if (cached) return cached;
  const db = new InvoxDB(`invox_${companyId}_${deviceId}`);
  dbCache.set(key, db);
  return db;
}
