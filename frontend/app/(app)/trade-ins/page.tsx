"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type TradeIn = {
  _id: string;
  tradeInNo: string;
  customerName?: string;
  customerPhone?: string;
  deviceBrand?: string;
  deviceModel?: string;
  imei?: string;
  serial?: string;
  condition?: string;
  offeredAmount?: number;
  agreedAmount?: number;
  creditAmount?: number;
  status: string;
  createdAt?: string;
};

const formatMoney = (value: number) => Number(value || 0).toFixed(2);

export default function TradeInsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    deviceBrand: "",
    deviceModel: "",
    imei: "",
    serial: "",
    condition: "",
    offeredAmount: 0,
    agreedAmount: 0,
    creditAmount: 0,
    status: "pending",
    notes: ""
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = statusFilter ? tradeIns.filter((t) => t.status === statusFilter) : tradeIns;
    if (!term) return list;
    return list.filter((t) => {
      return (
        String(t.tradeInNo || "").toLowerCase().includes(term) ||
        String(t.customerName || "").toLowerCase().includes(term) ||
        String(t.customerPhone || "").toLowerCase().includes(term) ||
        String(t.imei || "").toLowerCase().includes(term) ||
        String(t.serial || "").toLowerCase().includes(term) ||
        String(t.deviceModel || "").toLowerCase().includes(term)
      );
    });
  }, [tradeIns, q, statusFilter]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ tradeIns: TradeIn[] }>("/api/trade-ins?limit=300");
      setTradeIns(data.tradeIns || []);
    } catch (err: any) {
      setError(err.message || "Failed to load trade-ins");
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
      customerName: "",
      customerPhone: "",
      deviceBrand: "",
      deviceModel: "",
      imei: "",
      serial: "",
      condition: "",
      offeredAmount: 0,
      agreedAmount: 0,
      creditAmount: 0,
      status: "pending",
      notes: ""
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/trade-ins", {
        method: "POST",
        body: JSON.stringify({
          customerName: form.customerName || undefined,
          customerPhone: form.customerPhone || undefined,
          deviceBrand: form.deviceBrand || undefined,
          deviceModel: form.deviceModel || undefined,
          imei: form.imei || undefined,
          serial: form.serial || undefined,
          condition: form.condition || undefined,
          offeredAmount: Number(form.offeredAmount) || 0,
          agreedAmount: Number(form.agreedAmount) || 0,
          creditAmount: Number(form.creditAmount) || Number(form.agreedAmount) || 0,
          status: form.status || "pending",
          notes: form.notes || undefined
        })
      });
      resetForm();
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to create trade-in");
    } finally {
      setSaving(false);
    }
  };

  const patchTradeIn = async (row: TradeIn, next: Partial<TradeIn>) => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/trade-ins/${row._id}`, { method: "PATCH", body: JSON.stringify(next) });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to update trade-in");
    } finally {
      setSaving(false);
    }
  };

  const deleteTradeIn = async (row: TradeIn) => {
    if (!confirm(`Delete trade-in ${row.tradeInNo}?`)) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/trade-ins/${row._id}`, { method: "DELETE" });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to delete trade-in");
    } finally {
      setSaving(false);
    }
  };

  if (workspace && !workspace.enabledModules.includes("tradeins")) {
    return (
      <section className="panel">
        <div className="panel-title">Trade-ins</div>
        <div className="muted">Trade-ins are disabled for this workspace.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Trade-ins</div>
      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={handleCreate} style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <div className="grid-3">
          <label className="field">
            Customer name
            <input value={form.customerName} onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))} />
          </label>
          <label className="field">
            Customer phone
            <input value={form.customerPhone} onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))} />
          </label>
          <label className="field">
            Status
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="applied">Applied</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>

        <div className="grid-3">
          <label className="field">
            Brand
            <input value={form.deviceBrand} onChange={(e) => setForm((p) => ({ ...p, deviceBrand: e.target.value }))} />
          </label>
          <label className="field">
            Model
            <input value={form.deviceModel} onChange={(e) => setForm((p) => ({ ...p, deviceModel: e.target.value }))} />
          </label>
          <label className="field">
            IMEI
            <input value={form.imei} onChange={(e) => setForm((p) => ({ ...p, imei: e.target.value }))} />
          </label>
        </div>

        <div className="grid-4">
          <label className="field">
            Offered
            <input
              type="number"
              min={0}
              value={form.offeredAmount}
              onChange={(e) => setForm((p) => ({ ...p, offeredAmount: Number(e.target.value) }))}
            />
          </label>
          <label className="field">
            Agreed
            <input
              type="number"
              min={0}
              value={form.agreedAmount}
              onChange={(e) => setForm((p) => ({ ...p, agreedAmount: Number(e.target.value) }))}
            />
          </label>
          <label className="field">
            Credit
            <input
              type="number"
              min={0}
              value={form.creditAmount}
              onChange={(e) => setForm((p) => ({ ...p, creditAmount: Number(e.target.value) }))}
            />
          </label>
          <label className="field">
            Condition
            <input value={form.condition} onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Add trade-in"}
          </button>
          <button className="button secondary" type="button" onClick={resetForm} disabled={saving}>
            Clear
          </button>
        </div>
      </form>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input placeholder="Search trade-ins..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="applied">Applied</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="button secondary" type="button" onClick={loadAll} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="muted">No trade-ins found.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No</th>
                <th>Customer</th>
                <th>Device</th>
                <th>Status</th>
                <th>Credit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{row.tradeInNo}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ""}
                    </div>
                  </td>
                  <td>
                    <div>{row.customerName || "—"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {row.customerPhone || ""}
                    </div>
                  </td>
                  <td>
                    <div>{[row.deviceBrand, row.deviceModel].filter(Boolean).join(" ") || "—"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {row.imei || row.serial || ""}
                    </div>
                  </td>
                  <td>
                    <select value={row.status} onChange={(e) => patchTradeIn(row, { status: e.target.value })} disabled={saving}>
                      <option value="pending">Pending</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                      <option value="applied">Applied</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>{formatMoney(row.creditAmount || row.agreedAmount || 0)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="button danger" type="button" onClick={() => deleteTradeIn(row)} disabled={saving}>
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

