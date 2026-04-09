"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearToken, setToken } from "@/lib/auth";

function SuperAdminSsoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code") || "";
    if (!code) {
      setError("Missing SSO code.");
      return;
    }

    (async () => {
      try {
        const res = await apiFetch<{ token: string }>("/api/superadmin-sso/exchange", {
          method: "POST",
          body: JSON.stringify({ code })
        });
        setToken(res.token);
        const me = await apiFetch<{ user: { role?: string } }>("/api/auth/me");
        if (me.user?.role !== "super_admin") {
          clearToken();
          setError("This account is not authorized for Super Admin.");
          return;
        }
        router.replace("/dashboard");
      } catch (e: any) {
        clearToken();
        setError(e?.message || "SSO failed.");
      }
    })();
  }, [router, searchParams]);

  return (
    <div style={{ maxWidth: 640, margin: "60px auto" }}>
      <section className="panel">
        <div className="panel-title">Signing you in…</div>
        <div className="muted" style={{ marginTop: 8 }}>
          {error ? <span style={{ color: "var(--error)" }}>{error}</span> : "Redirecting to the Admin Console."}
        </div>
        {error ? (
          <div style={{ marginTop: 14 }}>
            <a className="button secondary" href="/login">
              Go to login
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function SuperAdminSsoPage() {
  return (
    <Suspense>
      <SuperAdminSsoClient />
    </Suspense>
  );
}
