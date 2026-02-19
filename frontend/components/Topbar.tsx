"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function Topbar() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: { name: string; email: string } }>("/api/auth/me")
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    apiFetch<{ readOnly: boolean; isTrial?: boolean; trialEndsAt?: string }>("/api/billing/status")
      .then((data) => {
        if (!active) return;
        setReadOnly(Boolean(data.readOnly));
        setIsTrial(Boolean(data.isTrial));
        setTrialEndsAt(data.trialEndsAt || null);
      })
      .catch(() => {
        if (!active) return;
        setReadOnly(false);
        setIsTrial(false);
        setTrialEndsAt(null);
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
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <div className="badge">Read-only mode · Subscription required</div>
            <Link className="button secondary" href="/plans">
              View plans
            </Link>
          </div>
        ) : isTrial ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <div className="badge">
              Trial ends {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : "soon"}
            </div>
            <Link className="button secondary" href="/plans">
              Upgrade
            </Link>
          </div>
        ) : null}
      </div>
      <div className="badge">{user ? `${user.name} · ${user.email}` : "Loading user..."}</div>
    </div>
  );
}
