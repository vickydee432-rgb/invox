"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Customer = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
};

type History = {
  invoices: any[];
  sales: any[];
  repairs: any[];
  tradeIns: any[];
  installments: any[];
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState<History | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => {
      return (
        String(c.name || "").toLowerCase().includes(term) ||
        String(c.phone || "").toLowerCase().includes(term) ||
        String(c.email || "").toLowerCase().includes(term)
      );
    });
  }, [customers, q]);

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ customers: Customer[] }>("/api/customers?limit=500");
      setCustomers(data.customers || []);
      if (!selectedId && data.customers?.[0]?._id) setSelectedId(data.customers[0]._id);
    } catch (err: any) {
      setError(err.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (id: string) => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const data = await apiFetch<{ history: History }>(`/api/customers/${id}/history`);
      setHistory(data.history || null);
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
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
      setHistory(null);
      return;
    }
    loadHistory(selectedId);
  }, [selectedId]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
          notes: notes || undefined
        })
      });
      resetForm();
      await loadCustomers();
    } catch (err: any) {
      setError(err.message || "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (customer: Customer, next: Partial<Customer>) => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/customers/${customer._id}`, {
        method: "PATCH",
        body: JSON.stringify(next)
      });
      await loadCustomers();
    } catch (err: any) {
      setError(err.message || "Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Delete customer "${customer.name}"?`)) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/customers/${customer._id}`, { method: "DELETE" });
      if (selectedId === customer._id) setSelectedId("");
      await loadCustomers();
    } catch (err: any) {
      setError(err.message || "Failed to delete customer");
    } finally {
      setSaving(false);
    }
  };

  if (workspace && !workspace.enabledModules.includes("customers")) {
    return (
      <section className="panel">
        <div className="panel-title">Customers</div>
        <div className="muted">Customers are disabled for this workspace.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Customers</div>
      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={handleCreate} style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <div className="grid-3">
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="field">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <div className="grid-2">
          <label className="field">
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="field">
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Add customer"}
          </button>
          <button className="button secondary" type="button" onClick={resetForm} disabled={saving}>
            Clear
          </button>
        </div>
      </form>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input
              placeholder="Search customers..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="button secondary" type="button" onClick={loadCustomers} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="muted">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="muted">No customers found.</div>
          ) : (
            <div className="list">
              {filtered.map((c) => (
                <div
                  key={c._id}
                  className={`list-row${selectedId === c._id ? " active" : ""}`}
                  style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}
                >
                  <button
                    type="button"
                    className="link"
                    onClick={() => setSelectedId(c._id)}
                    style={{ textAlign: "left" }}
                  >
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.phone ? c.phone : "No phone"}{c.email ? ` • ${c.email}` : ""}
                    </div>
                  </button>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() =>
                        handleUpdate(c, { isActive: c.isActive === false ? true : false })
                      }
                      disabled={saving}
                    >
                      {c.isActive === false ? "Activate" : "Deactivate"}
                    </button>
                    <button className="button danger" type="button" onClick={() => handleDelete(c)} disabled={saving}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>Customer history</div>
            {selectedId ? (
              <button className="button secondary" type="button" onClick={() => loadHistory(selectedId)} disabled={historyLoading}>
                {historyLoading ? "Loading..." : "Reload"}
              </button>
            ) : null}
          </div>

          {!selectedId ? (
            <div className="muted" style={{ marginTop: 8 }}>
              Select a customer to view history.
            </div>
          ) : historyLoading ? (
            <div className="muted" style={{ marginTop: 8 }}>
              Loading history...
            </div>
          ) : !history ? (
            <div className="muted" style={{ marginTop: 8 }}>
              No history available.
            </div>
          ) : (
            <div className="card" style={{ marginTop: 10 }}>
              <div className="grid-2">
                <div>
                  <div style={{ fontWeight: 600 }}>Sales</div>
                  <div className="muted">{history.sales?.length || 0} recent</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Invoices</div>
                  <div className="muted">{history.invoices?.length || 0} recent</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Repairs</div>
                  <div className="muted">{history.repairs?.length || 0} recent</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Trade-ins</div>
                  <div className="muted">{history.tradeIns?.length || 0} recent</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Installments</div>
                  <div className="muted">{history.installments?.length || 0} recent</div>
                </div>
              </div>
              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                Tip: After you start linking sales/invoices to customers, this history becomes more complete.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

