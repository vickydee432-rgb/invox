"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const BUSINESS_TYPES = [
  { key: "retail", title: "Retail", description: "Daily sales, receipts, and stock tracking." },
  { key: "construction", title: "Construction", description: "Quotes, invoices, projects, and expenses." },
  { key: "agency", title: "Agency", description: "Client projects, quotes, and invoicing." },
  { key: "services", title: "Services", description: "Service-based invoicing and expenses." },
  { key: "freelance", title: "Freelance", description: "Simple quotes, invoices, and expenses." }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState("construction");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/company/workspace", {
        method: "PUT",
        body: JSON.stringify({ businessType: selected })
      });
      window.dispatchEvent(new Event("workspace:updated"));
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to save workspace settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">Choose your business type</div>
      <p className="muted">
        We’ll tailor your workspace modules, labels, and dashboard for your workflow.
      </p>
      <div className="grid-two" style={{ marginTop: 16 }}>
        {BUSINESS_TYPES.map((type) => (
          <button
            key={type.key}
            type="button"
            className={`plan-card ${selected === type.key ? "featured" : ""}`}
            onClick={() => setSelected(type.key)}
          >
            <div className="plan-title">{type.title}</div>
            <div className="plan-subtitle">{type.description}</div>
          </button>
        ))}
      </div>
      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <button className="button" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </section>
  );
}
