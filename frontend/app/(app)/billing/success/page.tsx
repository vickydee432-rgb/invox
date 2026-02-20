"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function BillingSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Confirming your subscription...");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        await apiFetch("/api/billing/status");
        if (!active) return;
        setMessage("Payment received. Redirecting to your dashboard...");
      } catch (err) {
        if (!active) return;
        setMessage("Payment received. Redirecting to your dashboard...");
      }
    };
    refresh();
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 2500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-title">Subscription Activated</div>
      <div className="muted" style={{ marginTop: 8 }}>
        {message}
      </div>
      <div className="muted" style={{ marginTop: 6 }}>
        {params.get("status") ? `Status: ${params.get("status")}` : null}
      </div>
      <button className="button" style={{ marginTop: 16 }} onClick={() => router.push("/dashboard")}>
        Go to dashboard
      </button>
    </section>
  );
}
