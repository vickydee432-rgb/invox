"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [channel, setChannel] = useState<"email" | "sms" | "auto">("auto");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
        body: JSON.stringify({
          channel,
          email: channel === "email" || channel === "auto" ? email : undefined,
          phone: channel === "sms" || channel === "auto" ? phone : undefined
        })
      });
      setSuccess("If the account exists, a reset token has been sent.");
    } catch (err: any) {
      setError(err.message || "Failed to request reset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="panel-title">Forgot password</h2>
      <p className="muted">Request a password reset token via email or text message.</p>
      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "grid", gap: 14 }}>
        <label className="field">
          Send via
          <select value={channel} onChange={(e) => setChannel(e.target.value as any)}>
            <option value="auto">Auto (Email & SMS if available)</option>
            <option value="email">Email only</option>
            <option value="sms">Text message (SMS) only</option>
          </select>
        </label>
        {(channel === "email" || channel === "auto") && (
          <label className="field">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
        )}
        {(channel === "sms" || channel === "auto") && (
          <label className="field">
            Phone (E.164 format recommended)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
        )}
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
