"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearToken, setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(res.token);
      const me = await apiFetch<{ user: { role?: string } }>("/api/auth/me");
      if (me.user?.role !== "super_admin") {
        clearToken();
        setError("This account is not authorized for Super Admin.");
        return;
      }
      router.push("/dashboard");
    } catch (err: any) {
      clearToken();
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "60px auto" }}>
      <div className="topbar" style={{ marginBottom: 14 }}>
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-title">INVOX Super Admin</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Centralized analytics across all companies
            </div>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-title">Sign in</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Super Admin access only.
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <label className="field">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label className="field">
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>

          {error ? <div className="callout error">{error}</div> : null}

          <button className="button" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}

