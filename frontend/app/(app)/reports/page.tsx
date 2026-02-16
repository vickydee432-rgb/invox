"use client";

import { useEffect, useState } from "react";
import { apiDownload, apiFetch } from "@/lib/api";

type Summary = {
  quotes_count: number;
  quotes_total: number;
  invoices_count: number;
  invoices_billed_total: number;
  invoices_paid_total: number;
  invoices_outstanding: number;
  expenses_count: number;
  expenses_total: number;
  profit_on_paid: number;
  profit_on_billed: number;
  overdue_count: number;
};

type SeriesRow = {
  month: string;
  billed: number;
  paid: number;
  expenses: number;
};

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const query = params.toString();
    try {
      const data = await apiFetch<{ summary: Summary; series: SeriesRow[] }>(
        `/api/reports/overview${query ? `?${query}` : ""}`
      );
      setSummary(data.summary);
      setSeries(data.series || []);
    } catch (err: any) {
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    const path = `/api/reports/export.xlsx${query ? `?${query}` : ""}`;
    try {
      const filename = `reports_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await apiDownload(path, filename);
    } catch (err: any) {
      setError(err.message || "Failed to export reports");
    }
  };

  const handleExportPdf = async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    const path = `/api/reports/export.pdf${query ? `?${query}` : ""}`;
    try {
      const filename = `reports_${new Date().toISOString().slice(0, 10)}.pdf`;
      await apiDownload(path, filename);
    } catch (err: any) {
      setError(err.message || "Failed to export reports");
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <>
      <section className="panel">
        <div className="panel-title">Reports</div>
        <div className="grid-2">
          <label className="field">
            From
            <input value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
          </label>
          <label className="field">
            To
            <input value={to} onChange={(e) => setTo(e.target.value)} type="date" />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
          <button className="button" onClick={loadReports}>
            Apply filters
          </button>
          <button className="button secondary" onClick={handleExportExcel}>
            Export Excel
          </button>
          <button className="button secondary" onClick={handleExportPdf}>
            Export PDF
          </button>
          {error ? <div className="muted">{error}</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Summary</div>
        {loading ? (
          <div className="muted">Loading summary...</div>
        ) : summary ? (
          <div className="stat-grid">
            <div className="stat-card">
              <div className="muted">Quotes total</div>
              <div className="stat-value">{summary.quotes_total.toFixed(2)}</div>
              <div className="muted">Count: {summary.quotes_count}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Invoices billed</div>
              <div className="stat-value">{summary.invoices_billed_total.toFixed(2)}</div>
              <div className="muted">Count: {summary.invoices_count}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Invoices paid</div>
              <div className="stat-value">{summary.invoices_paid_total.toFixed(2)}</div>
              <div className="muted">Outstanding: {summary.invoices_outstanding.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Expenses</div>
              <div className="stat-value">{summary.expenses_total.toFixed(2)}</div>
              <div className="muted">Count: {summary.expenses_count}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Profit (paid)</div>
              <div className="stat-value">{summary.profit_on_paid.toFixed(2)}</div>
              <div className="muted">Overdue: {summary.overdue_count}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Profit (billed)</div>
              <div className="stat-value">{summary.profit_on_billed.toFixed(2)}</div>
            </div>
          </div>
        ) : (
          <div className="muted">No summary available.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Monthly Trend</div>
        {loading ? (
          <div className="muted">Loading series...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Billed</th>
                <th>Paid</th>
                <th>Expenses</th>
              </tr>
            </thead>
            <tbody>
              {series.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{row.billed.toFixed(2)}</td>
                  <td>{row.paid.toFixed(2)}</td>
                  <td>{row.expenses.toFixed(2)}</td>
                </tr>
              ))}
              {series.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No data for the selected range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
