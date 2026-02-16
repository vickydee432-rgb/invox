"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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

type ReportData = {
  summary: Summary;
  series: SeriesRow[];
  range: { from: string | null; to: string | null };
};

const formatMoney = (value: number) => value.toFixed(2);

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadDashboard = async (from = fromDate, to = toDate) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await apiFetch<ReportData>(`/api/reports/overview?${params.toString()}`);
      setSummary(data.summary);
      setSeries(data.series || []);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleApply = () => {
    loadDashboard(fromDate, toDate);
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    loadDashboard("", "");
  };

  return (
    <>
      <section className="panel">
        <div className="panel-title">Dashboard</div>
        <div className="grid-2">
          <label className="field">
            From
            <input value={fromDate} onChange={(e) => setFromDate(e.target.value)} type="date" />
          </label>
          <label className="field">
            To
            <input value={toDate} onChange={(e) => setToDate(e.target.value)} type="date" />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button className="button secondary" onClick={handleApply}>
            Apply range
          </button>
          <button className="button secondary" onClick={handleClear}>
            Clear
          </button>
          {error ? <div className="muted">{error}</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Key Stats</div>
        {loading || !summary ? (
          <div className="muted">Loading stats...</div>
        ) : (
          <div className="stat-grid">
            <div className="stat-card">
              <div className="muted">Quotes total</div>
              <div className="stat-value">{formatMoney(summary.quotes_total)}</div>
              <div className="muted">Count: {summary.quotes_count}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Invoices billed</div>
              <div className="stat-value">{formatMoney(summary.invoices_billed_total)}</div>
              <div className="muted">Count: {summary.invoices_count}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Invoices paid</div>
              <div className="stat-value">{formatMoney(summary.invoices_paid_total)}</div>
              <div className="muted">Outstanding: {formatMoney(summary.invoices_outstanding)}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Expenses total</div>
              <div className="stat-value">{formatMoney(summary.expenses_total)}</div>
              <div className="muted">Count: {summary.expenses_count}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Profit on paid</div>
              <div className="stat-value">{formatMoney(summary.profit_on_paid)}</div>
              <div className="muted">Profit on billed: {formatMoney(summary.profit_on_billed)}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Overdue invoices</div>
              <div className="stat-value">{summary.overdue_count}</div>
              <div className="muted">Needs follow-up</div>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Monthly Overview</div>
        {loading ? (
          <div className="muted">Loading monthly series...</div>
        ) : series.length === 0 ? (
          <div className="muted">No data available for the selected range.</div>
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
                  <td>{formatMoney(row.billed)}</td>
                  <td>{formatMoney(row.paid)}</td>
                  <td>{formatMoney(row.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
