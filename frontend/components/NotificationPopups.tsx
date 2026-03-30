"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildWorkspace } from "@/lib/workspace";

type Notification = {
  _id: string;
  type: string;
  message: string;
  severity?: "info" | "warning" | "danger";
  status?: "unread" | "read" | "dismissed";
  triggeredAt?: string;
  data?: any;
};

export default function NotificationPopups() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const data = await apiFetch<{ notifications: Notification[] }>("/api/notifications?status=unread");
      setNotifications(data.notifications || []);
    } catch (err: any) {
      // notifications module may be disabled or user lacks access
      setEnabled(false);
      setNotifications([]);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  };

  useEffect(() => {
    let active = true;
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => {
        if (!active) return;
        const workspace = buildWorkspace(data.company);
        setEnabled(workspace.enabledModules.includes("notifications"));
      })
      .catch(() => {
        if (!active) return;
        setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    let active = true;
    const safeLoad = async () => {
      if (!active) return;
      await load();
    };

    safeLoad();
    pollingRef.current = setInterval(safeLoad, 60_000);

    return () => {
      active = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [enabled]);

  const visible = useMemo(() => notifications.slice(0, 4), [notifications]);

  const dismiss = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    try {
      await apiFetch(`/api/notifications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "dismissed" })
      });
    } catch {
      // ignore
    }
  };

  const handleView = (note: Notification) => {
    if (note.type === "tax_deadline") {
      router.push("/tax");
      return;
    }
    router.push("/notifications");
  };

  if (!enabled || visible.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {visible.map((note) => {
        const sev = note.severity || "info";
        return (
          <div key={note._id} className={`toast ${sev}`}>
            <div className="toast-message">{note.message}</div>
            <div className="toast-actions">
              <button className="button secondary" type="button" onClick={() => handleView(note)}>
                View
              </button>
              <button className="button secondary" type="button" onClick={() => dismiss(note._id)}>
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
