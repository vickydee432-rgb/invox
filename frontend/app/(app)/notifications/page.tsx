"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";
import { getDeviceId } from "@/lib/device";
import { urlBase64ToUint8Array } from "@/lib/push";

type Notification = {
  _id: string;
  type: string;
  message: string;
  triggeredAt?: string;
};

export default function NotificationsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState("");

  const [type, setType] = useState("reminder");
  const [message, setMessage] = useState("");

  const loadNotifications = async () => {
    setError("");
    try {
      const data = await apiFetch<{ notifications: Notification[] }>("/api/notifications");
      setNotifications(data.notifications || []);
    } catch (err: any) {
      setError(err.message || "Failed to load notifications");
    }
  };

  useEffect(() => {
    let active = true;
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => {
        if (!active) return;
        const ws = buildWorkspace(data.company);
        setWorkspace(ws);
        if (!ws.enabledModules.includes("notifications")) return;
        loadNotifications();
      })
      .catch(() => {
        // ignore
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setPushSupported(supported);
    if (!supported) {
      setPushEnabled(false);
      setPushSubscribed(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const status = await apiFetch<{ subscribed: boolean; enabled: boolean }>("/api/push/me");
        if (!active) return;
        setPushEnabled(Boolean(status.enabled));

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushSubscribed(Boolean(sub) || Boolean(status.subscribed));
      } catch {
        if (!active) return;
        setPushEnabled(false);
        setPushSubscribed(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const enablePush = async () => {
    if (!pushSupported) return;
    if (pushBusy) return;
    setPushBusy(true);
    setPushNote("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushNote("Push permission was not granted.");
        return;
      }

      const { publicKey } = await apiFetch<{ publicKey: string }>("/api/push/public-key");
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await apiFetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          deviceId: getDeviceId(),
          userAgent: navigator.userAgent,
          subscription: subscription.toJSON()
        })
      });

      setPushSubscribed(true);
      setPushEnabled(true);
      setPushNote("Push enabled on this device.");
    } catch (err: any) {
      setPushNote(err?.message || "Failed to enable push notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    if (!pushSupported) return;
    if (pushBusy) return;
    setPushBusy(true);
    setPushNote("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch("/api/push/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ endpoint: sub.endpoint, deviceId: getDeviceId() })
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setPushSubscribed(false);
      setPushNote("Push disabled on this device.");
    } catch (err: any) {
      setPushNote(err?.message || "Failed to disable push notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ type, message })
      });
      setMessage("");
      await loadNotifications();
    } catch (err: any) {
      setError(err.message || "Failed to create notification");
    }
  };

  if (workspace && !workspace.enabledModules.includes("notifications")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.notifications || "Notifications"}</div>
        <div className="muted">Notifications are disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.notifications || "Notifications"}</div>
        <div className="muted">Review system alerts and reminders.</div>
        {error ? <div className="muted">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-title">Push notifications</div>
        {!pushSupported ? (
          <div className="muted">Push is not supported in this browser/device.</div>
        ) : pushEnabled === false ? (
          <div className="muted">Push is not enabled on the server yet.</div>
        ) : (
          <div className="muted">
            {pushSubscribed ? "Enabled on this device." : "Not enabled on this device."}
          </div>
        )}
        {pushNote ? <div className="muted" style={{ marginTop: 8 }}>{pushNote}</div> : null}
        {pushSupported && pushEnabled ? (
          <div className="report-actions" style={{ marginTop: 12 }}>
            {pushSubscribed ? (
              <button className="button secondary" type="button" onClick={disablePush} disabled={pushBusy}>
                {pushBusy ? "Working…" : "Disable push"}
              </button>
            ) : (
              <button className="button" type="button" onClick={enablePush} disabled={pushBusy}>
                {pushBusy ? "Working…" : "Enable push"}
              </button>
            )}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-title">Create Notification</div>
        <form onSubmit={handleCreate} className="grid-2">
          <label className="field">
            Type
            <input value={type} onChange={(e) => setType(e.target.value)} />
          </label>
          <label className="field">
            Message
            <input value={message} onChange={(e) => setMessage(e.target.value)} required />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Send notification
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">Recent Alerts</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Message</th>
                <th>Triggered</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((note) => (
                <tr key={note._id}>
                  <td>{note.type}</td>
                  <td>{note.message}</td>
                  <td>{note.triggeredAt ? new Date(note.triggeredAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No notifications yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
