"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { startSyncEngine } from "@/lib/sync";

export default function SyncBootstrap() {
  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        const [userRes, companyRes] = await Promise.all([
          apiFetch<{ user: { _id: string } }>("/api/auth/me"),
          apiFetch<{ company: { _id: string } }>("/api/company/me")
        ]);
        if (!active) return;
        const deviceId = getDeviceId();
        await apiFetch("/api/devices/register", {
          method: "POST",
          body: JSON.stringify({
            deviceId,
            name: navigator.userAgent,
            platform: navigator.platform
          })
        }).catch(() => {});
        await startSyncEngine({
          companyId: companyRes.company._id,
          workspaceId: companyRes.company._id,
          userId: userRes.user._id
        });
      } catch (err) {
        // defer sync until auth is ready
      }
    };
    boot();
    return () => {
      active = false;
    };
  }, []);

  return null;
}
