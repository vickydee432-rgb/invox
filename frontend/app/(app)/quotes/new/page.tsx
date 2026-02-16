"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type QuoteItem = {
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
};

export default function NewQuotePage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [vatRate, setVatRate] = useState(0);
  const [items, setItems] = useState<QuoteItem[]>([
    { description: "", qty: 1, unitPrice: 0, discount: 0 }
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateItem = (index: number, patch: Partial<QuoteItem>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, discount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          customerName,
          validUntil,
          vatRate,
          items
        })
      });
      router.push("/quotes");
    } catch (err: any) {
      setError(err.message || "Failed to create quote");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">Create Quote</div>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div className="grid-2">
          <label className="field">
            Customer name
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </label>
          <label className="field">
            Valid until
            <input value={validUntil} onChange={(e) => setValidUntil(e.target.value)} type="date" required />
          </label>
          <label className="field">
            VAT rate %
            <input
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
              type="number"
              min={0}
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item, index) => (
            <div key={index} className="grid-2">
              <label className="field">
                Description
                <input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                Quantity
                <input
                  value={item.qty}
                  onChange={(e) => updateItem(index, { qty: Number(e.target.value) })}
                  type="number"
                  min={0}
                  required
                />
              </label>
              <label className="field">
                Unit price
                <input
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
                  type="number"
                  min={0}
                  required
                />
              </label>
              <label className="field">
                Discount
                <input
                  value={item.discount ?? 0}
                  onChange={(e) => updateItem(index, { discount: Number(e.target.value) })}
                  type="number"
                  min={0}
                />
              </label>
              {items.length > 1 ? (
                <button className="button secondary" type="button" onClick={() => removeItem(index)}>
                  Remove item
                </button>
              ) : null}
            </div>
          ))}
          <button className="button secondary" type="button" onClick={addItem}>
            Add item
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create quote"}
          </button>
          <button className="button secondary" type="button" onClick={() => router.push("/quotes")}>
            Cancel
          </button>
        </div>

        {error ? <div className="muted">{error}</div> : null}
      </form>
    </section>
  );
}
