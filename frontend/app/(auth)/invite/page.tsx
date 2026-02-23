"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("Invite token missing.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string }>("/api/users/invite/accept", {
        method: "POST",
        body: JSON.stringify({ token, name, password })
      });
      setToken(data.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to accept invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2>Accept Invite</h2>
      <p className="muted" style={{ marginTop: 8 }}>
        Create your account to join the workspace.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <label className="field">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        <label className="field">
          Confirm password
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" required />
        </label>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Accept invite"}
        </button>
        {error ? <div className="muted">{error}</div> : null}
      </form>
    </>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="muted">Loading invite...</div>}>
      <InviteForm />
    </Suspense>
  );
}
