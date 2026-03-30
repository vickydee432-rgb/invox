"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type PhoneItem = {
  _id: string;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  condition?: string;
  imei?: string;
  serial?: string;
  costPrice?: number;
  salePrice?: number;
  status: string;
  receivedAt?: string;
  notes?: string;
};

const formatMoney = (value: number) => Number(value || 0).toFixed(2);

export default function PhoneInventoryPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [items, setItems] = useState<PhoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [form, setForm] = useState({
    brand: "",
    model: "",
    storage: "",
    color: "",
    condition: "",
    imei: "",
    serial: "",
    costPrice: 0,
    salePrice: 0,
    status: "in_stock",
    notes: ""
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = statusFilter ? items.filter((i) => i.status === statusFilter) : items;
    if (!term) return list;
    return list.filter((i) => {
      return (
        `${i.brand} ${i.model}`.toLowerCase().includes(term) ||
        String(i.imei || "").toLowerCase().includes(term) ||
        String(i.serial || "").toLowerCase().includes(term)
      );
    });
  }, [items, q, statusFilter]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ items: PhoneItem[] }>("/api/phone-inventory?limit=500");
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load phone inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => {
        if (!active) return;
        setWorkspace(buildWorkspace(data.company));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const resetForm = () => {
    setForm({
      brand: "",
      model: "",
      storage: "",
      color: "",
      condition: "",
      imei: "",
      serial: "",
      costPrice: 0,
      salePrice: 0,
      status: "in_stock",
      notes: ""
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/phone-inventory", {
        method: "POST",
        body: JSON.stringify({
          brand: form.brand,
          model: form.model,
          storage: form.storage || undefined,
          color: form.color || undefined,
          condition: form.condition || undefined,
          imei: form.imei || undefined,
          serial: form.serial || undefined,
          costPrice: Number(form.costPrice) || 0,
          salePrice: Number(form.salePrice) || 0,
          status: form.status,
          notes: form.notes || undefined
        })
      });
      resetForm();
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to add phone");
    } finally {
      setSaving(false);
    }
  };

  const patchItem = async (item: PhoneItem, next: Partial<PhoneItem>) => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/phone-inventory/${item._id}`, { method: "PATCH", body: JSON.stringify(next) });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to update phone");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: PhoneItem) => {
    if (!confirm(`Delete ${item.brand} ${item.model} (${item.imei || item.serial || "no-id"})?`)) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/phone-inventory/${item._id}`, { method: "DELETE" });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to delete phone");
    } finally {
      setSaving(false);
    }
  };

  if (workspace && !workspace.inventoryEnabled) {
    return (
      <section className="panel">
        <div className="panel-title">Phones</div>
        <div className="muted">Inventory is disabled for this workspace.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Phone inventory</div>
      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={handleCreate} style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <div className="grid-3">
          <label className="field">
            Brand
            <input value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))} required />
          </label>
          <label className="field">
            Model
            <input value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} required />
          </label>
          <label className="field">
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="in_stock">In stock</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
              <option value="in_repair">In repair</option>
              <option value="returned">Returned</option>
            </select>
          </label>
        </div>

        <div className="grid-4">
          <label className="field">
            Storage
            <input value={form.storage} onChange={(e) => setForm((p) => ({ ...p, storage: e.target.value }))} placeholder="e.g. 128GB" />
          </label>
          <label className="field">
            Color
            <input value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} />
          </label>
          <label className="field">
            Condition
            <input value={form.condition} onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))} placeholder="e.g. New/Used/A" />
          </label>
          <label className="field">
            IMEI
            <input value={form.imei} onChange={(e) => setForm((p) => ({ ...p, imei: e.target.value }))} />
          </label>
        </div>

        <div className="grid-4">
          <label className="field">
            Serial
            <input value={form.serial} onChange={(e) => setForm((p) => ({ ...p, serial: e.target.value }))} />
          </label>
          <label className="field">
            Cost price
            <input type="number" min={0} value={form.costPrice} onChange={(e) => setForm((p) => ({ ...p, costPrice: Number(e.target.value) }))} />
          </label>
          <label className="field">
            Sale price
            <input type="number" min={0} value={form.salePrice} onChange={(e) => setForm((p) => ({ ...p, salePrice: Number(e.target.value) }))} />
          </label>
          <div className="field">
            Margin
            <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
              {formatMoney((Number(form.salePrice) || 0) - (Number(form.costPrice) || 0))}
            </div>
          </div>
        </div>

        <label className="field">
          Notes
          <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" type="submit" disabled={saving || !form.brand.trim() || !form.model.trim()}>
            {saving ? "Saving..." : "Add phone"}
          </button>
          <button className="button secondary" type="button" onClick={resetForm} disabled={saving}>
            Clear
          </button>
        </div>
      </form>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input placeholder="Search phones..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
          <option value="in_repair">In repair</option>
          <option value="returned">Returned</option>
        </select>
        <button className="button secondary" type="button" onClick={loadAll} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="muted">No phones found.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Phone</th>
                <th>IMEI/Serial</th>
                <th>Status</th>
                <th>Cost</th>
                <th>Sale</th>
                <th>Actions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{i.brand} {i.model}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {[i.storage, i.color, i.condition].filter(Boolean).join(" • ")}
                    </div>
                  </td>
                  <td>{i.imei || i.serial || "—"}</td>
                  <td>
                    <select value={i.status} onChange={(e) => patchItem(i, { status: e.target.value })} disabled={saving}>
                      <option value="in_stock">In stock</option>
                      <option value="reserved">Reserved</option>
                      <option value="sold">Sold</option>
                      <option value="in_repair">In repair</option>
                      <option value="returned">Returned</option>
                    </select>
                  </td>
                  <td>{formatMoney(i.costPrice || 0)}</td>
                  <td>{formatMoney(i.salePrice || 0)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {i.status === "in_stock" ? (
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => patchItem(i, { status: "reserved" })}
                          disabled={saving}
                        >
                          Reserve
                        </button>
                      ) : null}
                      {i.status === "reserved" ? (
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => patchItem(i, { status: "in_stock" })}
                          disabled={saving}
                        >
                          Unreserve
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="button danger" type="button" onClick={() => deleteItem(i)} disabled={saving}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
