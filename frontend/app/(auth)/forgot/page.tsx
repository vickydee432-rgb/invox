"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setSuccess("If the account exists, a reset link has been sent.");
    } catch (err: any) {
      setError(err.message || "Failed to request reset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="panel-title">Forgot password</h2>
      <p className="muted">Enter your email to request a password reset.</p>
      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "grid", gap: 14 }}>
        <label className="field">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        {error ? <div className="muted">{error}</div> : null}
        {success ? <div className="muted">{success}</div> : null}
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Requesting..." : "Request reset"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        Have a token? <Link href="/reset">Reset password</Link>
      </p>
      <p className="muted" style={{ marginTop: 6 }}>
        Back to <Link href="/login">Login</Link>
      </p>
    </div>
  );
}
