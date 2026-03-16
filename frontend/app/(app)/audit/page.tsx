"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type AuditLog = {
  _id: string;
  createdAt: string;
  actorEmail?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  statusCode?: number;
  metadata?: any;
};

const formatDateTime = (value: string) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ q: "", entityType: "", from: "", to: "" });

  const load = async (targetPage = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", "100");
      if (applied.q) params.set("q", applied.q);
      if (applied.entityType) params.set("entityType", applied.entityType);
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      const data = await apiFetch<{ logs: AuditLog[]; page: number; pages: number }>(`/api/audit?${params.toString()}`);
      setLogs(data.logs || []);
      setPage(data.page || targetPage);
      setPages(data.pages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
      setLogs([]);
      setPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  const entityTypes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((row) => {
      if (row.entityType) set.add(String(row.entityType));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  return (
    <section className="panel">
      <div className="panel-title">Audit log</div>
      <div className="muted">Tracks changes made in the system.</div>

      <div className="filter-row" style={{ marginTop: 16 }}>
        <label className="field" style={{ minWidth: 220 }}>
          Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. invoices, DELETE, user@email" />
        </label>
        <label className="field" style={{ minWidth: 220 }}>
          Entity
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setApplied({ q: q.trim(), entityType: entityType.trim(), from, to });
            setPage(1);
          }}
        >
          Apply
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setQ("");
            setEntityType("");
            setFrom("");
            setTo("");
            setApplied({ q: "", entityType: "", from: "", to: "" });
            setPage(1);
          }}
        >
          Clear
        </button>
      </div>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}

      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="muted">
                  Loading…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No logs found.
                </td>
              </tr>
            ) : (
              logs.map((row) => (
                <tr key={row._id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{row.actorEmail || "—"}</td>
                  <td>{row.action || "—"}</td>
                  <td>
                    {row.entityType || "—"}
                    {row.entityId ? <div className="muted">{row.entityId}</div> : null}
                  </td>
                  <td>{row.statusCode ?? "—"}</td>
                  <td style={{ maxWidth: 360 }}>
                    {row.metadata ? (
                      <details>
                        <summary style={{ cursor: "pointer" }}>View</summary>
                        <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 12 }}>
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <button className="button secondary" type="button" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
          Prev
        </button>
        <div className="pagination-status muted">
          Page {page} of {pages}
        </div>
        <button
          className="button secondary"
          type="button"
          disabled={page >= pages || loading}
          onClick={() => load(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}

