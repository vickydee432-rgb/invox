"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Expense = {
  _id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  projectLabel?: string;
};

const toDateInputValue = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function EditExpensePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [projectLabel, setProjectLabel] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{ expense: Expense }>(`/api/expenses/${id}`)
      .then((data) => {
        if (!active) return;
        setTitle(data.expense.title || "");
        setCategory(data.expense.category || "");
        setAmount(data.expense.amount || 0);
        setDate(toDateInputValue(data.expense.date));
        setProjectLabel(data.expense.projectLabel || "");
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err.message || "Failed to load expense");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/expenses/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          category,
          amount,
          date,
          projectLabel: projectLabel || undefined
        })
      });
      router.push("/expenses");
    } catch (err: any) {
      setError(err.message || "Failed to update expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm("Delete this expense? This cannot be undone.");
    if (!ok) return;
    try {
      await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
      router.push("/expenses");
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
    }
  };

  if (loading) {
    return (
      <section className="panel">
        <div className="panel-title">Edit Expense</div>
        <div className="muted">Loading expense...</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Edit Expense</div>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div className="grid-2">
          <label className="field">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field">
            Category
            <input value={category} onChange={(e) => setCategory(e.target.value)} required />
          </label>
          <label className="field">
            Amount
            <input
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              type="number"
              min={0}
              required
            />
          </label>
          <label className="field">
            Date
            <input value={date} onChange={(e) => setDate(e.target.value)} type="date" required />
          </label>
          <label className="field">
            Project label (optional)
            <input value={projectLabel} onChange={(e) => setProjectLabel(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Update expense"}
          </button>
          <button className="button secondary" type="button" onClick={() => router.push("/expenses")}>
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
