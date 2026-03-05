"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/lib/db";
import { getDeviceId } from "@/lib/device";
import { getSyncContext } from "@/lib/syncContext";

type Status = {
  label: string;
  tone: "neutral" | "warn" | "error";
};

export default function SyncStatus() {
  const [status, setStatus] = useState<Status>({ label: "Sync idle", tone: "neutral" });

  useEffect(() => {
    let active = true;
    const update = async () => {
      if (!active) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus({ label: "Offline", tone: "warn" });
        return;
      }
      const context = getSyncContext();
      if (!context) {
        setStatus({ label: "Sync idle", tone: "neutral" });
        return;
      }
      const db = getDb(context.companyId, getDeviceId());
      const pending = await db.sync_queue.where("status").anyOf("pending", "syncing").count();
      const failed = await db.sync_queue.where("status").equals("failed").count();
      if (!active) return;
      if (failed > 0) {
        setStatus({ label: "Sync failed", tone: "error" });
      } else if (pending > 0) {
        setStatus({ label: `Syncing (${pending})`, tone: "warn" });
      } else {
        setStatus({ label: "All synced", tone: "neutral" });
      }
    };

    const interval = window.setInterval(update, 5000);
    const onOnline = () => update();
    const onOffline = () => update();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    update();

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return <div className={`badge${status.tone === "error" ? " danger" : status.tone === "warn" ? " warn" : ""}`}>{status.label}</div>;
}
