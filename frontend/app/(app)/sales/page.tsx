"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Sale = {
  _id: string;
  saleNo: string;
  customerName?: string;
  branchName?: string;
  total: number;
  amountPaid: number;
  balance: number;
  status: string;
  issueDate: string;
};

const LIMIT = 12;

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

  const loadSales = async (targetPage = page, keyword = query, statusValue = statusFilter) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", String(LIMIT));
      if (keyword) params.set("q", keyword);
      if (statusValue) params.set("status", statusValue);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const data = await apiFetch<{ sales: Sale[]; page: number; pages: number }>(
        `/api/sales?${params.toString()}`
      );
      setSales(data.sales || []);
      setPage(data.page);
      setPages(data.pages);
    } catch (err: any) {
      setError(err.message || "Failed to load sales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales(page, query, statusFilter);
  }, [page, query, statusFilter, fromDate, toDate]);

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

  const handleSearch = () => {
    setPage(1);
    setQuery(search.trim());
    setStatusFilter(status.trim());
  };

  const handleClear = () => {
    setSearch("");
    setQuery("");
    setStatus("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  if (workspace && !workspace.enabledModules.includes("sales")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.sales || "Sales"}</div>
        <div className="muted">Sales are disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">{workspace?.labels?.sales || "Sales"}</div>
      {loading ? (
        <div className="muted">Loading sales...</div>
      ) : (
        <>
          <div
            className="filter-row"
            style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}
          >
            <label className="field" style={{ flex: "1 1 240px" }}>
              Search customer
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Walk-in" />
            </label>
            <label className="field" style={{ minWidth: 160 }}>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="field" style={{ minWidth: 160 }}>
              From
              <input value={fromDate} onChange={(e) => setFromDate(e.target.value)} type="date" />
            </label>
            <label className="field" style={{ minWidth: 160 }}>
              To
              <input value={toDate} onChange={(e) => setToDate(e.target.value)} type="date" />
            </label>
            <button className="button secondary" onClick={handleSearch}>
              Search
            </button>
            <button className="button secondary" onClick={handleClear}>
              Clear
            </button>
            <Link className="button" href="/sales/new">
              Add sale
            </Link>
            {error ? <div className="muted">{error}</div> : null}
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>No</th>
                <th>Customer</th>
                <th>Branch</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale._id}>
                  <td>{sale.saleNo}</td>
                  <td>{sale.customerName || "Walk-in"}</td>
                  <td>{sale.branchName || "-"}</td>
                  <td>{sale.total.toFixed(2)}</td>
                  <td>{sale.amountPaid.toFixed(2)}</td>
                  <td>{sale.balance.toFixed(2)}</td>
                  <td>
                    <span className="badge">{sale.status}</span>
                  </td>
                  <td>{new Date(sale.issueDate).toLocaleDateString()}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <Link className="button secondary" href={`/sales/${sale._id}/edit`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No sales yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
            <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </button>
            <div className="muted">
              Page {page} of {pages}
            </div>
            <button className="button secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
