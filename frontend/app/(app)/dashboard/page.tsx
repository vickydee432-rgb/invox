"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
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
  businessType?: string;
  retail?: {
    sales_today: number;
    expenses_today: number;
    profit_today: number;
    stock_value: number;
    low_stock_count: number;
  } | null;
};

const formatMoney = (value: number) => value.toFixed(2);

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [retailSummary, setRetailSummary] = useState<ReportData["retail"]>(null);
  const [recentInvoices, setRecentInvoices] = useState<
    { _id: string; customerName: string; total: number; issueDate: string }[]
  >([]);
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
      setRetailSummary(data.retail || null);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
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
    if (!workspace?.enabledModules.includes("invoices")) {
      setRecentInvoices([]);
      return;
    }
    let active = true;
    apiFetch<{ invoices: { _id: string; customerName: string; total: number; issueDate: string }[] }>(
      "/api/invoices?limit=4&page=1"
    )
      .then((data) => {
        if (!active) return;
        setRecentInvoices(data.invoices || []);
      })
      .catch(() => {
        if (!active) return;
        setRecentInvoices([]);
      });
    return () => {
      active = false;
    };
  }, [workspace?.enabledModules]);

  const handleApply = () => {
    loadDashboard(fromDate, toDate);
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    loadDashboard("", "");
  };

  const balanceValue =
    workspace?.businessType === "retail" && retailSummary
      ? retailSummary.sales_today - retailSummary.expenses_today
      : summary
      ? summary.invoices_paid_total - summary.expenses_total
      : 0;

  return (
    <>
      <section className="mobile-dashboard">
        <div className="mobile-header">
          <button className="icon-button" type="button" onClick={() => router.push("/settings")}>
            ⚙
          </button>
          <div>
            <div className="muted">Welcome back</div>
            <div className="mobile-title">{workspace?.labels?.dashboard || "Dashboard"}</div>
          </div>
          <button className="icon-button" type="button" onClick={() => router.push("/reports")}>
            🔔
          </button>
        </div>

        <div className="mobile-balance-card">
          <div className="muted">{workspace?.businessType === "retail" ? "Sales balance" : "Account balance"}</div>
          <div className="mobile-balance">{formatMoney(balanceValue)}</div>
          <div className="muted">Updated today</div>
        </div>

        <div className="mobile-action-grid">
          {workspace?.enabledModules.includes("invoices") ? (
            <button className="mobile-action" type="button" onClick={() => router.push("/invoices/new")}>
              {workspace?.labels?.invoiceSingular || "Invoice"}
            </button>
          ) : null}
          {workspace?.enabledModules.includes("expenses") ? (
            <button className="mobile-action" type="button" onClick={() => router.push("/expenses/new")}>
              Expense
            </button>
          ) : null}
          {workspace?.inventoryEnabled ? (
            <button className="mobile-action" type="button" onClick={() => router.push("/inventory")}>
              Inventory
            </button>
          ) : null}
          <button className="mobile-action" type="button" onClick={() => router.push("/reports")}>
            Reports
          </button>
        </div>

        <div className="mobile-section">
          <div className="mobile-section-header">
            <div>Recent activity</div>
            <button className="link-button" type="button" onClick={() => router.push("/invoices")}>
              See all
            </button>
          </div>
          <div className="mobile-list">
            {recentInvoices.length > 0 ? (
              recentInvoices.map((inv) => (
                <div key={inv._id} className="mobile-list-item">
                  <div>
                    <div>{inv.customerName}</div>
                    <div className="muted">{new Date(inv.issueDate).toLocaleDateString()}</div>
                  </div>
                  <div className="mobile-amount">{formatMoney(inv.total)}</div>
                </div>
              ))
            ) : (
              <div className="muted">No recent invoices.</div>
            )}
          </div>
        </div>
      </section>

      <div className="dashboard-desktop">
        <section className="panel">
          <div className="panel-title">{workspace?.labels?.dashboard || "Dashboard"}</div>
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
              {workspace?.businessType === "retail" && retailSummary ? (
                <>
                  <div className="stat-card">
                    <div className="muted">Sales today</div>
                    <div className="stat-value">{formatMoney(retailSummary.sales_today)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="muted">Expenses today</div>
                    <div className="stat-value">{formatMoney(retailSummary.expenses_today)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="muted">Profit today</div>
                    <div className="stat-value">{formatMoney(retailSummary.profit_today)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="muted">Stock value</div>
                    <div className="stat-value">{formatMoney(retailSummary.stock_value)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="muted">Low stock items</div>
                    <div className="stat-value">{retailSummary.low_stock_count}</div>
                  </div>
                </>
              ) : null}
              {workspace?.enabledModules.includes("quotes") ? (
                <div className="stat-card">
                  <div className="muted">Quotes total</div>
                  <div className="stat-value">{formatMoney(summary.quotes_total)}</div>
                  <div className="muted">Count: {summary.quotes_count}</div>
                </div>
              ) : null}
              {workspace?.enabledModules.includes("invoices") ? (
                <div className="stat-card">
                  <div className="muted">{workspace?.labels?.invoices || "Invoices"} billed</div>
                  <div className="stat-value">{formatMoney(summary.invoices_billed_total)}</div>
                  <div className="muted">Count: {summary.invoices_count}</div>
                </div>
              ) : null}
              {workspace?.enabledModules.includes("invoices") ? (
                <div className="stat-card">
                  <div className="muted">{workspace?.labels?.invoices || "Invoices"} paid</div>
                  <div className="stat-value">{formatMoney(summary.invoices_paid_total)}</div>
                  <div className="muted">Outstanding: {formatMoney(summary.invoices_outstanding)}</div>
                </div>
              ) : null}
              <div className="stat-card">
                <div className="muted">Expenses total</div>
                <div className="stat-value">{formatMoney(summary.expenses_total)}</div>
                <div className="muted">Count: {summary.expenses_count}</div>
              </div>
              {workspace?.enabledModules.includes("invoices") ? (
                <div className="stat-card">
                  <div className="muted">Profit on paid</div>
                  <div className="stat-value">{formatMoney(summary.profit_on_paid)}</div>
                  <div className="muted">Profit on billed: {formatMoney(summary.profit_on_billed)}</div>
                </div>
              ) : null}
              {workspace?.enabledModules.includes("invoices") ? (
                <div className="stat-card">
                  <div className="muted">Overdue {workspace?.labels?.invoices || "Invoices"}</div>
                  <div className="stat-value">{summary.overdue_count}</div>
                  <div className="muted">Needs follow-up</div>
                </div>
              ) : null}
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
      </div>
    </>
  );
}
