"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const qEmail = searchParams.get("email");
    const qToken = searchParams.get("token");
    if (qEmail) setEmail(qEmail);
    if (qToken) setToken(qToken);
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth/reset", {
        method: "POST",
        body: JSON.stringify({ email, token, newPassword })
      });
      setSuccess("Password reset successfully. You can now log in.");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="panel-title">Reset password</h2>
      <p className="muted">Enter the reset token and your new password.</p>
      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "grid", gap: 14 }}>
        <label className="field">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="field">
          Reset token
          <input value={token} onChange={(e) => setToken(e.target.value)} required />
        </label>
        <label className="field">
          New password
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" required />
        </label>
        <label className="field">
          Confirm password
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error ? <div className="muted">{error}</div> : null}
        {success ? <div className="muted">{success}</div> : null}
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        Back to <Link href="/login">Login</Link>
      </p>
    </div>
  );
}
