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
const formatMoney = (value: number) => value.toFixed(2);

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

  const renderSaleActions = (sale: Sale) => (
    sale._id ? (
      <Link className="button secondary" href={`/sales/${sale._id}/edit`}>
        Edit
      </Link>
    ) : (
      <button className="button secondary" type="button" disabled title="Missing sale id">
        Edit
      </button>
    )
  );

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
            <button className="button secondary" type="button" onClick={handleSearch}>
              Search
            </button>
            <button className="button secondary" type="button" onClick={handleClear}>
              Clear
            </button>
            <Link className="button" href="/sales/new">
              Add sale
            </Link>
            {error ? <div className="muted">{error}</div> : null}
          </div>

          <table className="table desktop-table">
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
                  <td>{formatMoney(sale.total)}</td>
                  <td>{formatMoney(sale.amountPaid)}</td>
                  <td>{formatMoney(sale.balance)}</td>
                  <td>
                    <span className="badge">{sale.status}</span>
                  </td>
                  <td>{new Date(sale.issueDate).toLocaleDateString()}</td>
                  <td><div className="mobile-inline-actions">{renderSaleActions(sale)}</div></td>
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

          <div className="mobile-record-list">
            {sales.map((sale) => (
              <article key={sale._id} className="mobile-record-card">
                <div className="mobile-record-header">
                  <div>
                    <div className="mobile-record-title">{sale.saleNo}</div>
                    <div className="mobile-record-subtitle">{sale.customerName || "Walk-in"}</div>
                  </div>
                  <span className="badge">{sale.status}</span>
                </div>
                <div className="mobile-record-grid">
                  <div className="mobile-record-item">
                    <span className="mobile-record-label">Branch</span>
                    <span>{sale.branchName || "-"}</span>
                  </div>
                  <div className="mobile-record-item">
                    <span className="mobile-record-label">Date</span>
                    <span>{new Date(sale.issueDate).toLocaleDateString()}</span>
                  </div>
                  <div className="mobile-record-item">
                    <span className="mobile-record-label">Total</span>
                    <span>{formatMoney(sale.total)}</span>
                  </div>
                  <div className="mobile-record-item">
                    <span className="mobile-record-label">Paid</span>
                    <span>{formatMoney(sale.amountPaid)}</span>
                  </div>
                  <div className="mobile-record-item">
                    <span className="mobile-record-label">Balance</span>
                    <span>{formatMoney(sale.balance)}</span>
                  </div>
                </div>
                <div className="mobile-record-actions">{renderSaleActions(sale)}</div>
              </article>
            ))}
            {sales.length === 0 ? <div className="muted">No sales yet.</div> : null}
          </div>

          <div className="pagination-row">
            <button className="button secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </button>
            <div className="muted pagination-status">
              Page {page} of {pages}
            </div>
            <button className="button secondary" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
