"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function Topbar() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: { name: string; email: string } }>("/api/auth/me")
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    apiFetch<{ readOnly: boolean }>("/api/billing/status")
      .then((data) => {
        if (active) setReadOnly(Boolean(data.readOnly));
      })
      .catch(() => {
        if (active) setReadOnly(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="topbar">
      <div>
        <div className="panel-title">Cashflow Studio</div>
        <p className="muted">Quotes, invoices, and expenses in one clean ledger.</p>
        {readOnly ? (
          <div className="badge" style={{ marginTop: 8 }}>
            Read-only mode · Subscription required
          </div>
        ) : null}
      </div>
      <div className="badge">{user ? `${user.name} · ${user.email}` : "Loading user..."}</div>
    </div>
  );
}
