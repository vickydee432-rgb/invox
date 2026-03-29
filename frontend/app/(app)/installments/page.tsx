"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type InstallmentPlan = {
  _id: string;
  planNo: string;
  customerName?: string;
  customerPhone?: string;
  referenceType?: string;
  referenceNo?: string;
  totalAmount: number;
  downPayment?: number;
  amountPaid?: number;
  balance?: number;
  installmentCount?: number;
  frequency?: string;
  status: string;
  createdAt?: string;
  payments?: { date: string; amount: number; note?: string }[];
};

const formatMoney = (value: number) => Number(value || 0).toFixed(2);

export default function InstallmentsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    referenceNo: "",
    totalAmount: 0,
    downPayment: 0,
    installmentCount: 6,
    frequency: "monthly",
    notes: ""
  });

  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    method: "",
    reference: "",
    note: ""
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = statusFilter ? plans.filter((p) => p.status === statusFilter) : plans;
    if (!term) return list;
    return list.filter((p) => {
      return (
        String(p.planNo || "").toLowerCase().includes(term) ||
        String(p.customerName || "").toLowerCase().includes(term) ||
        String(p.customerPhone || "").toLowerCase().includes(term) ||
        String(p.referenceNo || "").toLowerCase().includes(term)
      );
    });
  }, [plans, q, statusFilter]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ plans: InstallmentPlan[] }>("/api/installments?limit=300");
      const list = data.plans || [];
      setPlans(list);
      if (!selectedId && list[0]?._id) setSelectedId(list[0]._id);
    } catch (err: any) {
      setError(err.message || "Failed to load installment plans");
    } finally {
      setLoading(false);
    }
  };

  const loadOne = async (id: string) => {
    if (!id) return;
    try {
      const data = await apiFetch<{ plan: InstallmentPlan }>(`/api/installments/${id}`);
      setSelectedPlan(data.plan || null);
    } catch {
      setSelectedPlan(null);
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

  useEffect(() => {
    if (!selectedId) {
      setSelectedPlan(null);
      return;
    }
    loadOne(selectedId);
  }, [selectedId]);

  const resetForm = () => {
    setForm({
      customerName: "",
      customerPhone: "",
      referenceNo: "",
      totalAmount: 0,
      downPayment: 0,
      installmentCount: 6,
      frequency: "monthly",
      notes: ""
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/installments", {
        method: "POST",
        body: JSON.stringify({
          customerName: form.customerName || undefined,
          customerPhone: form.customerPhone || undefined,
          referenceNo: form.referenceNo || undefined,
          totalAmount: Number(form.totalAmount) || 0,
          downPayment: Number(form.downPayment) || 0,
          installmentCount: Number(form.installmentCount) || 1,
          frequency: form.frequency || "monthly",
          notes: form.notes || undefined
        })
      });
      resetForm();
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to create plan");
    } finally {
      setSaving(false);
    }
  };

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/installments/${selectedId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          date: paymentForm.date,
          amount: Number(paymentForm.amount) || 0,
          method: paymentForm.method || undefined,
          reference: paymentForm.reference || undefined,
          note: paymentForm.note || undefined
        })
      });
      setPaymentForm((p) => ({ ...p, amount: 0, note: "" }));
      await loadAll();
      await loadOne(selectedId);
    } catch (err: any) {
      setError(err.message || "Failed to add payment");
    } finally {
      setSaving(false);
    }
  };

  const patchPlan = async (plan: InstallmentPlan, next: Partial<InstallmentPlan>) => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/installments/${plan._id}`, { method: "PATCH", body: JSON.stringify(next) });
      await loadAll();
      if (selectedId === plan._id) await loadOne(plan._id);
    } catch (err: any) {
      setError(err.message || "Failed to update plan");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (plan: InstallmentPlan) => {
    if (!confirm(`Delete installment plan ${plan.planNo}?`)) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/installments/${plan._id}`, { method: "DELETE" });
      if (selectedId === plan._id) setSelectedId("");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to delete plan");
    } finally {
      setSaving(false);
    }
  };

  if (workspace && !workspace.enabledModules.includes("installments")) {
    return (
      <section className="panel">
        <div className="panel-title">Installments</div>
        <div className="muted">Installments are disabled for this workspace.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Hire purchase / Installments</div>
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
            Reference (optional)
            <input value={form.referenceNo} onChange={(e) => setForm((p) => ({ ...p, referenceNo: e.target.value }))} />
          </label>
        </div>

        <div className="grid-4">
          <label className="field">
            Total amount
            <input type="number" min={0} value={form.totalAmount} onChange={(e) => setForm((p) => ({ ...p, totalAmount: Number(e.target.value) }))} />
          </label>
          <label className="field">
            Down payment
            <input type="number" min={0} value={form.downPayment} onChange={(e) => setForm((p) => ({ ...p, downPayment: Number(e.target.value) }))} />
          </label>
          <label className="field">
            Installments
            <input type="number" min={1} value={form.installmentCount} onChange={(e) => setForm((p) => ({ ...p, installmentCount: Number(e.target.value) }))} />
          </label>
          <label className="field">
            Frequency
            <select value={form.frequency} onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" type="submit" disabled={saving || (Number(form.totalAmount) || 0) <= 0}>
            {saving ? "Saving..." : "Create plan"}
          </button>
          <button className="button secondary" type="button" onClick={resetForm} disabled={saving}>
            Clear
          </button>
        </div>
      </form>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input placeholder="Search plans..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="defaulted">Defaulted</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className="button secondary" type="button" onClick={loadAll} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="muted">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="muted">No installment plans found.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p._id} className={selectedId === p._id ? "active" : ""}>
                      <td>
                        <button className="link" type="button" onClick={() => setSelectedId(p._id)} style={{ fontWeight: 700 }}>
                          {p.planNo}
                        </button>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.referenceNo ? `Ref: ${p.referenceNo}` : ""}
                        </div>
                      </td>
                      <td>
                        <div>{p.customerName || "—"}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.customerPhone || ""}
                        </div>
                      </td>
                      <td>
                        <select value={p.status} onChange={(e) => patchPlan(p, { status: e.target.value })} disabled={saving}>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="defaulted">Defaulted</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>{formatMoney(p.totalAmount || 0)}</td>
                      <td>{formatMoney(p.balance || 0)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="button danger" type="button" onClick={() => deletePlan(p)} disabled={saving}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Payments</div>
          {!selectedId ? (
            <div className="muted">Select a plan to add payments.</div>
          ) : !selectedPlan ? (
            <div className="muted">Loading plan...</div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="grid-3">
                  <div>
                    <div className="muted">Total</div>
                    <div style={{ fontWeight: 700 }}>{formatMoney(selectedPlan.totalAmount || 0)}</div>
                  </div>
                  <div>
                    <div className="muted">Paid</div>
                    <div style={{ fontWeight: 700 }}>{formatMoney(selectedPlan.amountPaid || 0)}</div>
                  </div>
                  <div>
                    <div className="muted">Balance</div>
                    <div style={{ fontWeight: 700 }}>{formatMoney(selectedPlan.balance || 0)}</div>
                  </div>
                </div>
              </div>

              <form onSubmit={addPayment} style={{ display: "grid", gap: 10 }}>
                <div className="grid-3">
                  <label className="field">
                    Date
                    <input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm((p) => ({ ...p, date: e.target.value }))} required />
                  </label>
                  <label className="field">
                    Amount
                    <input type="number" min={0} value={paymentForm.amount} onChange={(e) => setPaymentForm((p) => ({ ...p, amount: Number(e.target.value) }))} required />
                  </label>
                  <label className="field">
                    Method
                    <input value={paymentForm.method} onChange={(e) => setPaymentForm((p) => ({ ...p, method: e.target.value }))} />
                  </label>
                </div>
                <div className="grid-2">
                  <label className="field">
                    Reference
                    <input value={paymentForm.reference} onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))} />
                  </label>
                  <label className="field">
                    Note
                    <input value={paymentForm.note} onChange={(e) => setPaymentForm((p) => ({ ...p, note: e.target.value }))} />
                  </label>
                </div>
                <button className="button" type="submit" disabled={saving || (Number(paymentForm.amount) || 0) <= 0}>
                  {saving ? "Saving..." : "Add payment"}
                </button>
              </form>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Recent payments</div>
                {(selectedPlan.payments || []).length === 0 ? (
                  <div className="muted">No payments yet.</div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedPlan.payments || [])
                          .slice()
                          .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
                          .slice(0, 10)
                          .map((pay: any, idx: number) => (
                            <tr key={`${pay.date}-${idx}`}>
                              <td>{pay.date ? new Date(pay.date).toLocaleDateString() : ""}</td>
                              <td>{formatMoney(pay.amount || 0)}</td>
                              <td>{pay.note || ""}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

