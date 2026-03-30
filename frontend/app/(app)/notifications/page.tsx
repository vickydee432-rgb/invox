"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

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
