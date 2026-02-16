"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type QuoteItem = {
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
};

type Quote = {
  _id: string;
  customerName: string;
  validUntil: string;
  vatRate: number;
  items: QuoteItem[];
};

const toDateInputValue = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function EditQuotePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [vatRate, setVatRate] = useState(0);
  const [items, setItems] = useState<QuoteItem[]>([
    { description: "", qty: 1, unitPrice: 0, discount: 0 }
  ]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{ quote: Quote }>(`/api/quotes/${id}`)
      .then((data) => {
        if (!active) return;
        setCustomerName(data.quote.customerName || "");
        setValidUntil(toDateInputValue(data.quote.validUntil));
        setVatRate(data.quote.vatRate ?? 0);
        setItems(
          (data.quote.items || []).map((item) => ({
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount ?? 0
          }))
        );
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err.message || "Failed to load quote");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

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
      await apiFetch(`/api/quotes/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          customerName,
          validUntil,
          vatRate,
          items
        })
      });
      router.push("/quotes");
    } catch (err: any) {
      setError(err.message || "Failed to update quote");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm("Delete this quote? This cannot be undone.");
    if (!ok) return;
    try {
      await apiFetch(`/api/quotes/${id}`, { method: "DELETE" });
      router.push("/quotes");
    } catch (err: any) {
      setError(err.message || "Failed to delete quote");
    }
  };

  if (loading) {
    return (
      <section className="panel">
        <div className="panel-title">Edit Quote</div>
        <div className="muted">Loading quote...</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Edit Quote</div>
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
            {saving ? "Saving..." : "Update quote"}
          </button>
          <button className="button secondary" type="button" onClick={() => router.push("/quotes")}>
            Cancel
          </button>
          <button className="button secondary" type="button" onClick={handleDelete}>
            Delete
          </button>
        </div>
        {error ? <div className="muted">{error}</div> : null}
      </form>
    </section>
  );
}
