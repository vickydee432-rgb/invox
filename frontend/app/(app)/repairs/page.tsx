"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type RepairJob = {
  _id: string;
  jobNo: string;
  customerName?: string;
  customerPhone?: string;
  deviceBrand?: string;
  deviceModel?: string;
  imei?: string;
  serial?: string;
  status: string;
  technicianId?: string | null;
  laborCharge?: number;
  partsCharge?: number;
  totalCharge?: number;
  amountPaid?: number;
  balance?: number;
  receivedAt?: string;
};

type User = { _id: string; name: string; role?: string };

const formatMoney = (value: number) => Number(value || 0).toFixed(2);

export default function RepairsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [users, setUsers] = useState<User[]>([]);
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
    issueDescription: "",
    technicianId: "",
    laborCharge: 0,
    partsCharge: 0,
    amountPaid: 0
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = statusFilter ? jobs.filter((j) => j.status === statusFilter) : jobs;
    if (!term) return list;
    return list.filter((j) => {
      return (
        String(j.jobNo || "").toLowerCase().includes(term) ||
        String(j.customerName || "").toLowerCase().includes(term) ||
        String(j.customerPhone || "").toLowerCase().includes(term) ||
        String(j.imei || "").toLowerCase().includes(term) ||
        String(j.serial || "").toLowerCase().includes(term) ||
        String(j.deviceModel || "").toLowerCase().includes(term)
      );
    });
  }, [jobs, q, statusFilter]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [jobData, userData] = await Promise.all([
        apiFetch<{ jobs: RepairJob[] }>("/api/repairs?limit=300"),
        apiFetch<{ users: User[] }>("/api/users")
      ]);
      setJobs(jobData.jobs || []);
      setUsers(userData.users || []);
    } catch (err: any) {
      setError(err.message || "Failed to load repairs");
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
      issueDescription: "",
      technicianId: "",
      laborCharge: 0,
      partsCharge: 0,
      amountPaid: 0
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/repairs", {
        method: "POST",
        body: JSON.stringify({
          customerName: form.customerName || undefined,
          customerPhone: form.customerPhone || undefined,
          deviceBrand: form.deviceBrand || undefined,
          deviceModel: form.deviceModel || undefined,
          imei: form.imei || undefined,
          serial: form.serial || undefined,
          issueDescription: form.issueDescription,
          technicianId: form.technicianId || undefined,
          laborCharge: Number(form.laborCharge) || 0,
          partsCharge: Number(form.partsCharge) || 0,
          amountPaid: Number(form.amountPaid) || 0
        })
      });
      resetForm();
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to create repair job");
    } finally {
      setSaving(false);
    }
  };

  const patchJob = async (job: RepairJob, next: Partial<RepairJob>) => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/repairs/${job._id}`, { method: "PATCH", body: JSON.stringify(next) });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to update repair job");
    } finally {
      setSaving(false);
    }
  };

  const deleteJob = async (job: RepairJob) => {
    if (!confirm(`Delete repair job ${job.jobNo}?`)) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/repairs/${job._id}`, { method: "DELETE" });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to delete repair job");
    } finally {
      setSaving(false);
    }
  };

  const techName = (id?: string | null) => users.find((u) => u._id === id)?.name || "";

  if (workspace && !workspace.enabledModules.includes("repairs")) {
    return (
      <section className="panel">
        <div className="panel-title">Repairs</div>
        <div className="muted">Repairs are disabled for this workspace.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Repairs</div>
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
            Technician
            <select value={form.technicianId} onChange={(e) => setForm((p) => ({ ...p, technicianId: e.target.value }))}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
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
            IMEI / Serial
            <input
              value={form.imei || form.serial}
              onChange={(e) => setForm((p) => ({ ...p, imei: e.target.value, serial: "" }))}
              placeholder="IMEI preferred"
            />
          </label>
        </div>

        <label className="field">
          Issue description
          <input
            value={form.issueDescription}
            onChange={(e) => setForm((p) => ({ ...p, issueDescription: e.target.value }))}
            required
          />
        </label>

        <div className="grid-4">
          <label className="field">
            Labor charge
            <input
              type="number"
              min={0}
              value={form.laborCharge}
              onChange={(e) => setForm((p) => ({ ...p, laborCharge: Number(e.target.value) }))}
            />
          </label>
          <label className="field">
            Parts charge
            <input
              type="number"
              min={0}
              value={form.partsCharge}
              onChange={(e) => setForm((p) => ({ ...p, partsCharge: Number(e.target.value) }))}
            />
          </label>
          <label className="field">
            Amount paid
            <input
              type="number"
              min={0}
              value={form.amountPaid}
              onChange={(e) => setForm((p) => ({ ...p, amountPaid: Number(e.target.value) }))}
            />
          </label>
          <div className="field">
            Total
            <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
              {formatMoney(Number(form.laborCharge || 0) + Number(form.partsCharge || 0))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" type="submit" disabled={saving || !form.issueDescription.trim()}>
            {saving ? "Saving..." : "Create job"}
          </button>
          <button className="button secondary" type="button" onClick={resetForm} disabled={saving}>
            Clear
          </button>
        </div>
      </form>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input placeholder="Search repairs..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In progress</option>
          <option value="waiting_parts">Waiting parts</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="button secondary" type="button" onClick={loadAll} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="muted">No repair jobs found.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Customer</th>
                <th>Device</th>
                <th>Technician</th>
                <th>Status</th>
                <th>Total</th>
                <th>Balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{job.jobNo}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {job.receivedAt ? new Date(job.receivedAt).toLocaleDateString() : ""}
                    </div>
                  </td>
                  <td>
                    <div>{job.customerName || "—"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {job.customerPhone || ""}
                    </div>
                  </td>
                  <td>
                    <div>{[job.deviceBrand, job.deviceModel].filter(Boolean).join(" ") || "—"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {job.imei || job.serial || ""}
                    </div>
                  </td>
                  <td>
                    <select
                      value={job.technicianId || ""}
                      onChange={(e) => patchJob(job, { technicianId: e.target.value || null })}
                      disabled={saving}
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={job.status}
                      onChange={(e) => patchJob(job, { status: e.target.value })}
                      disabled={saving}
                    >
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In progress</option>
                      <option value="waiting_parts">Waiting parts</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>{formatMoney(job.totalCharge || 0)}</td>
                  <td>{formatMoney(job.balance || 0)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="button danger" type="button" onClick={() => deleteJob(job)} disabled={saving}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        Technician assigned: {jobs.filter((j) => j.technicianId).length} / {jobs.length}
        {jobs.length ? ` • Example: ${techName(jobs[0].technicianId)}` : ""}
      </div>
    </section>
  );
}

