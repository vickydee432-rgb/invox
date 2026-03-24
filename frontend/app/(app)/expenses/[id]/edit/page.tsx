"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BaseRecord, getDb } from "@/lib/db";
import { getDeviceId } from "@/lib/device";
import { isProbablyMongoObjectId, normalizeRecordId } from "@/lib/ids";
import { enqueueChange } from "@/lib/sync";
import { getSyncContext } from "@/lib/syncContext";

type Expense = BaseRecord & {
  title?: string;
  category?: string;
  amount?: number;
  date?: string;
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
  const rawId: any = params?.id;
  const id = normalizeRecordId(Array.isArray(rawId) ? rawId[0] : rawId);
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
    const load = async () => {
      try {
        if (!id) {
          setError("Invalid expense id.");
          return;
        }
        const context = getSyncContext();
        if (!context) {
          setError("Offline data not ready. Connect online once to initialize sync.");
          return;
        }
        const db = getDb(context.companyId, getDeviceId());
        let local = (await db.expenses.get(id)) as Expense | undefined;
        if (!local && typeof navigator !== "undefined" && navigator.onLine) {
          let serverLookupId: string | null = isProbablyMongoObjectId(id) ? id : null;
          if (!serverLookupId) {
            const map = await db.id_map
              .where("companyId")
              .equals(context.companyId)
              .and((row: any) => row.workspaceId === context.workspaceId && row.entityType === "expense" && row.localId === id)
              .first();
            if (map?.serverId && isProbablyMongoObjectId(map.serverId)) {
              serverLookupId = map.serverId;
            }
          }

          if (serverLookupId) {
            const data = await apiFetch<{ expense: any }>(`/expenses/${serverLookupId}`);
            const serverExpenseId = normalizeRecordId(data.expense?._id ?? data.expense?.id);
            if (data.expense && serverExpenseId) {
              const mapped = {
                id,
                serverId: serverExpenseId,
                companyId: context.companyId,
                workspaceId: context.workspaceId,
                userId: context.userId,
                deviceId: getDeviceId(),
                createdAt: data.expense.createdAt || new Date().toISOString(),
                updatedAt: data.expense.updatedAt || new Date().toISOString(),
                deletedAt: data.expense.deletedAt || null,
                version: data.expense.version || 1,
                title: data.expense.title,
                category: data.expense.category,
                amount: data.expense.amount,
                date: data.expense.date,
                projectLabel: data.expense.projectLabel || ""
              };
              await db.expenses.put(mapped);
              local = mapped;
            }
          }
        }
        if (!local) {
          setError("Expense not found locally.");
          return;
        }
        if (!active) return;
        setTitle(local.title || "");
        setCategory(local.category || "");
        setAmount(local.amount || 0);
        setDate(toDateInputValue(local.date));
        setProjectLabel(local.projectLabel || "");
      } catch (err: any) {
        if (!active) return;
        setError(err.message || "Failed to load expense");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!id) {
        setError("Invalid expense id.");
        setSaving(false);
        return;
      }
      const context = getSyncContext();
      if (!context) {
        setError("Offline data not ready. Connect online once to initialize sync.");
        setSaving(false);
        return;
      }
      const db = getDb(context.companyId, getDeviceId());
      const existing = await db.expenses.get(id);
      if (!existing) {
        setError("Expense not found locally.");
        setSaving(false);
        return;
      }
      const now = new Date().toISOString();
      const serverPayload = {
        title,
        category,
        amount,
        date,
        projectLabel: projectLabel || undefined
      };
      if (typeof navigator !== "undefined" && navigator.onLine && existing.serverId) {
        await apiFetch(`/expenses/${existing.serverId}`, {
          method: "PUT",
          body: JSON.stringify(serverPayload)
        });
      } else {
        await enqueueChange(context, {
          entityType: "expense",
          operation: "update",
          recordId: id,
          serverId: existing.serverId ?? null,
          payload: {
            ...existing,
            ...serverPayload,
            projectLabel: projectLabel || undefined,
            updatedAt: now,
            version: (existing.version || 1) + 1
          }
        });
      }
      const updated = {
        ...existing,
        title,
        category,
        amount,
        date,
        projectLabel: projectLabel || undefined,
        updatedAt: now,
        version: (existing.version || 1) + 1
      };
      await db.expenses.put(updated);
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
      if (!id) {
        setError("Invalid expense id.");
        return;
      }
      const context = getSyncContext();
      if (!context) {
        setError("Offline data not ready. Connect online once to initialize sync.");
        return;
      }
      const db = getDb(context.companyId, getDeviceId());
      const existing = await db.expenses.get(id);
      if (!existing) {
        if (typeof navigator !== "undefined" && navigator.onLine) {
          await apiFetch(`/expenses/${id}`, { method: "DELETE" });
        }
        router.push("/expenses");
        return;
      }
      const now = new Date().toISOString();
      const next = {
        ...existing,
        deletedAt: now,
        updatedAt: now,
        version: (existing.version || 1) + 1
      };
      await db.expenses.put(next);
      await enqueueChange(context, {
        entityType: "expense",
        operation: "delete",
        recordId: id,
        serverId: existing.serverId ?? null,
        payload: next
      });
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
