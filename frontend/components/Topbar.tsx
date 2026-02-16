"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function Topbar() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: { name: string; email: string } }>("/api/auth/me")
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
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
      </div>
      <div className="badge">{user ? `${user.name} · ${user.email}` : "Loading user..."}</div>
    </div>
  );
}
