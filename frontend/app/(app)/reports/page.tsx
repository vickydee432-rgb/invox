"use client";

import { useEffect, useState } from "react";
import { apiDownload, apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

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

type RetailSummary = {
  sales_today: number;
  expenses_today: number;
  profit_today: number;
  stock_value: number;
  low_stock_count: number;
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
  const [retailSummary, setRetailSummary] = useState<RetailSummary | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
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
      const data = await apiFetch<{
        summary: Summary;
        series: SeriesRow[];
        businessType?: string;
        retail?: RetailSummary | null;
      }>(`/api/reports/overview${query ? `?${query}` : ""}`);
      setSummary(data.summary);
      setSeries(data.series || []);
      setRetailSummary(data.retail || null);
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

  const invoiceLabel = workspace?.labels?.invoices || "Invoices";
  const quoteLabel = workspace?.labels?.quotes || "Quotes";

  if (workspace && !workspace.enabledModules.includes("reports")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.reports || "Reports"}</div>
        <div className="muted">Reports are disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.reports || "Reports"}</div>
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
            {workspace?.businessType === "retail" && retailSummary ? (
              <>
                <div className="stat-card">
                  <div className="muted">Sales today</div>
                  <div className="stat-value">{retailSummary.sales_today.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Expenses today</div>
                  <div className="stat-value">{retailSummary.expenses_today.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Profit today</div>
                  <div className="stat-value">{retailSummary.profit_today.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Stock value</div>
                  <div className="stat-value">{retailSummary.stock_value.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Low stock items</div>
                  <div className="stat-value">{retailSummary.low_stock_count}</div>
                </div>
              </>
            ) : null}
            {workspace?.enabledModules?.includes("quotes") ? (
              <div className="stat-card">
                <div className="muted">{quoteLabel} total</div>
                <div className="stat-value">{summary.quotes_total.toFixed(2)}</div>
                <div className="muted">Count: {summary.quotes_count}</div>
              </div>
            ) : null}
            {workspace?.enabledModules?.includes("invoices") ? (
              <div className="stat-card">
                <div className="muted">{invoiceLabel} billed</div>
                <div className="stat-value">{summary.invoices_billed_total.toFixed(2)}</div>
                <div className="muted">Count: {summary.invoices_count}</div>
              </div>
            ) : null}
            {workspace?.enabledModules?.includes("invoices") ? (
              <div className="stat-card">
                <div className="muted">{invoiceLabel} paid</div>
                <div className="stat-value">{summary.invoices_paid_total.toFixed(2)}</div>
                <div className="muted">Outstanding: {summary.invoices_outstanding.toFixed(2)}</div>
              </div>
            ) : null}
            <div className="stat-card">
              <div className="muted">Expenses</div>
              <div className="stat-value">{summary.expenses_total.toFixed(2)}</div>
              <div className="muted">Count: {summary.expenses_count}</div>
            </div>
            {workspace?.enabledModules?.includes("invoices") ? (
              <div className="stat-card">
                <div className="muted">Profit (paid)</div>
                <div className="stat-value">{summary.profit_on_paid.toFixed(2)}</div>
                <div className="muted">Overdue: {summary.overdue_count}</div>
              </div>
            ) : null}
            {workspace?.enabledModules?.includes("invoices") ? (
              <div className="stat-card">
                <div className="muted">Profit (billed)</div>
                <div className="stat-value">{summary.profit_on_billed.toFixed(2)}</div>
              </div>
            ) : null}
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
