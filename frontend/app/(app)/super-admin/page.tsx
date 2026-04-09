"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function SuperAdminLauncherPage() {
  const defaultUrl = "https://airy-hope-production.up.railway.app";
  const rawUrl = process.env.NEXT_PUBLIC_SUPERADMIN_APP_URL || defaultUrl;
  const baseUrl = useMemo(() => {
    if (!rawUrl) return "";
    return rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
  }, [rawUrl]);

  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    if (!baseUrl) {
      setRedirecting(false);
      setError("Super Admin app URL is not configured.");
      return;
    }
    (async () => {
      try {
        const me = await apiFetch<{ user: { role?: string } }>("/api/auth/me");
        if (me.user?.role !== "super_admin") {
          setError("You don’t have access to Super Admin.");
          setRedirecting(false);
          return;
        }
        const res = await apiFetch<{ code: string }>("/api/superadmin-sso/start", {
          method: "POST",
          body: JSON.stringify({})
        });
        const trimmedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        const next = `${trimmedBaseUrl}/sso?code=${encodeURIComponent(res.code)}`;
        window.location.href = next;
      } catch (e: any) {
        setError(e?.message || "Failed to start Super Admin SSO.");
        setRedirecting(false);
      }
    })();
  }, [baseUrl]);

  return (
    <section className="panel">
      <div className="panel-title">Admin Console</div>
      <div className="muted" style={{ marginTop: 8 }}>
        {redirecting ? "Redirecting and signing you in…" : "Open the standalone Admin Console."}
      </div>
      {error ? (
        <div className="muted" style={{ marginTop: 10, color: "var(--error-color, red)" }}>
          {error}
        </div>
      ) : null}
      {!redirecting && baseUrl ? (
        <div className="muted" style={{ marginTop: 10 }}>
          <Link href={baseUrl} target="_blank" rel="noreferrer">
            {rawUrl}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
