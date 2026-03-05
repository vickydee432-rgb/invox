"use client";

export type StoredSyncContext = {
  companyId: string;
  workspaceId: string;
  userId: string;
};

const SYNC_CONTEXT_KEY = "invox_sync_context";

export function getSyncContext(): StoredSyncContext | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SYNC_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.companyId || !parsed?.workspaceId || !parsed?.userId) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function setSyncContext(context: StoredSyncContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYNC_CONTEXT_KEY, JSON.stringify(context));
}
