"use client";

import { useEffect, useMemo, useState } from "react";
import { apiDownload, apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Summary = {
  quotes_count: number;
  quotes_total: number;
  sales_count: number;
  sales_total: number;
  sales_paid_total: number;
  sales_outstanding: number;
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
  sales?: number;
  salesPaid?: number;
};

type Account = {
  _id: string;
  code?: string;
  name: string;
  type: string;
};

type Period = {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed?: boolean;
};

type FinancialReportType = "income" | "balance" | "cash" | "trial" | "ledger" | "tax-vat" | "tax-turnover";

const formatMoney = (value: number) => value.toFixed(2);

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [retailSummary, setRetailSummary] = useState<RetailSummary | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [financialType, setFinancialType] = useState<FinancialReportType>("income");
  const [financialData, setFinancialData] = useState<any>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialError, setFinancialError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [asAt, setAsAt] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [ledgerAccountId, setLedgerAccountId] = useState("");

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

  const loadFinancialLookups = async () => {
    if (!workspace?.enabledModules?.includes("accounting")) return;
    try {
      const [accountData, periodData] = await Promise.all([
        apiFetch<{ accounts: Account[] }>("/api/accounting/accounts"),
        apiFetch<{ periods: Period[] }>("/api/accounting/periods")
      ]);
      const accountRows = accountData.accounts || [];
      setAccounts(accountRows);
      setPeriods(periodData.periods || []);
      if (!ledgerAccountId && accountRows.length > 0) {
        setLedgerAccountId(accountRows[0]._id);
      }
    } catch (err: any) {
      setFinancialError(err.message || "Failed to load accounting lookups");
    }
  };

  const loadFinancialReport = async () => {
    setFinancialLoading(true);
    setFinancialError("");
    try {
      let data: any = null;
      if (financialType === "income") {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        data = await apiFetch(`/api/reports/income-statement${params.toString() ? `?${params}` : ""}`);
      } else if (financialType === "balance") {
        const params = new URLSearchParams();
        if (asAt) params.set("asAt", asAt);
        data = await apiFetch(`/api/reports/balance-sheet${params.toString() ? `?${params}` : ""}`);
      } else if (financialType === "cash") {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        data = await apiFetch(`/api/reports/cash-flow${params.toString() ? `?${params}` : ""}`);
      } else if (financialType === "trial") {
        const params = new URLSearchParams();
        if (periodId) params.set("periodId", periodId);
        data = await apiFetch(`/api/reports/trial-balance${params.toString() ? `?${params}` : ""}`);
      } else if (financialType === "ledger") {
        if (!ledgerAccountId) throw new Error("Select an account to view the ledger.");
        data = await apiFetch(`/api/reports/general-ledger?accountId=${ledgerAccountId}`);
      } else if (financialType === "tax-vat") {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        data = await apiFetch(`/api/reports/tax/vat-return?${params}`);
      } else if (financialType === "tax-turnover") {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        data = await apiFetch(`/api/reports/tax/turnover-tax?${params}`);
      }
      setFinancialData(data);
    } catch (err: any) {
      setFinancialError(err.message || "Failed to load financial report");
      setFinancialData(null);
    } finally {
      setFinancialLoading(false);
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

  const handleExportExpensesExcel = async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    const path = `/expenses/export.xlsx${query ? `?${query}` : ""}`;
    try {
      const filename = `expenses_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await apiDownload(path, filename);
    } catch (err: any) {
      setError(err.message || "Failed to export expenses");
    }
  };

  const handleExportInvoicesExcel = async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    const path = `/api/invoices/export.xlsx${query ? `?${query}` : ""}`;
    try {
      const filename = `invoices_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await apiDownload(path, filename);
    } catch (err: any) {
      setError(err.message || "Failed to export invoices");
    }
  };

  const handleExportQuotesExcel = async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    const path = `/api/quotes/export.xlsx${query ? `?${query}` : ""}`;
    try {
      const filename = `quotes_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await apiDownload(path, filename);
    } catch (err: any) {
      setError(err.message || "Failed to export quotes");
    }
  };

  const handleExportSalesExcel = async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    const path = `/api/sales/export.xlsx${query ? `?${query}` : ""}`;
    try {
      const filename = `sales_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await apiDownload(path, filename);
    } catch (err: any) {
      setError(err.message || "Failed to export sales");
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

  useEffect(() => {
    if (!asAt) {
      setAsAt(new Date().toISOString().slice(0, 10));
    }
  }, [asAt]);

  useEffect(() => {
    loadFinancialLookups();
  }, [workspace]);

  const invoiceLabel = workspace?.labels?.invoices || "Invoices";
  const quoteLabel = workspace?.labels?.quotes || "Quotes";
  const salesLabel = workspace?.labels?.sales || "Sales";
  const expenseLabel = workspace?.labels?.expenses || "Expenses";
  const accountMap = useMemo(() => new Map(accounts.map((account) => [String(account._id), account])), [accounts]);

  const renderFinancialReport = () => {
    if (!workspace?.enabledModules?.includes("accounting")) {
      return <div className="muted">Enable the Accounting module to view financial statements.</div>;
    }
    if (financialLoading) return <div className="muted">Loading report...</div>;
    if (financialError) return <div className="muted">{financialError}</div>;
    if (!financialData) return <div className="muted">Run a report to see results.</div>;

    if (financialType === "income") {
      return (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="muted">Total income</div>
              <div className="stat-value">{formatMoney(financialData.totalIncome || 0)}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Total expenses</div>
              <div className="stat-value">{formatMoney(financialData.totalExpense || 0)}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Net profit</div>
              <div className="stat-value">{formatMoney(financialData.netProfit || 0)}</div>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {(financialData.rows || []).map((row: any) => (
                  <tr key={row.accountId || row._id}>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{formatMoney(Number(row.balance || 0))}</td>
                  </tr>
                ))}
                {(financialData.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No income statement lines yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (financialType === "balance") {
      const rows = financialData.rows || [];
      return (
        <>
          <div className="muted">As at {new Date(financialData.asAt || new Date()).toLocaleDateString()}</div>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => (
                  <tr key={row.accountId || row._id}>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{formatMoney(Number(row.balance || 0))}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No balance sheet data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (financialType === "cash") {
      return (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="muted">Net cash</div>
            <div className="stat-value">{formatMoney(financialData.netCash || 0)}</div>
          </div>
        </div>
      );
    }

    if (financialType === "trial") {
      const rows = financialData.rows || [];
      return (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Debit</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
                const account = accountMap.get(String(row._id));
                return (
                  <tr key={row._id}>
                    <td>{account ? `${account.name}${account.code ? ` (${account.code})` : ""}` : row._id}</td>
                    <td>{formatMoney(Number(row.debit || 0))}</td>
                    <td>{formatMoney(Number(row.credit || 0))}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No trial balance rows yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      );
    }

    if (financialType === "ledger") {
      const lines = financialData.lines || [];
      return (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Debit</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any) => (
                <tr key={line._id}>
                  <td>{line.createdAt ? new Date(line.createdAt).toLocaleDateString() : "-"}</td>
                  <td>{formatMoney(Number(line.debit || 0))}</td>
                  <td>{formatMoney(Number(line.credit || 0))}</td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No ledger entries for this account.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      );
    }

    if (financialType === "tax-vat") {
      return (
        <div className="stack">
           <div className="stat-grid">
            <div className="stat-card">
              <div className="muted">Net VAT Payable</div>
              <div className="stat-value">{formatMoney(financialData.netVatPayable || 0)}</div>
              <div className="muted">{financialData.status}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Output VAT (Sales)</div>
              <div className="stat-value">{formatMoney(financialData.outputs?.outputVat || 0)}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Input VAT (Purchases)</div>
              <div className="stat-value">{formatMoney(financialData.inputs?.inputVat || 0)}</div>
            </div>
          </div>
          <div className="panel-subtle" style={{marginTop: 16}}>
            <div style={{fontWeight: 600}}>Details</div>
            <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8}}>
              <div>Standard Rated Sales: {formatMoney(financialData.outputs?.standardRatedSales || 0)}</div>
              <div>Standard Rated Purchases: {formatMoney(financialData.inputs?.standardRatedPurchases || 0)}</div>
            </div>
          </div>
        </div>
      )
    }

    if (financialType === "tax-turnover") {
      return (
        <div className="stack">
           <div className="stat-grid">
            <div className="stat-card">
              <div className="muted">Tax Due (4%)</div>
              <div className="stat-value">{formatMoney(financialData.taxDue || 0)}</div>
            </div>
            <div className="stat-card">
              <div className="muted">Gross Turnover</div>
              <div className="stat-value">{formatMoney(financialData.grossTurnover || 0)}</div>
            </div>
          </div>
        </div>
      )
    }

    return null;
  };

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
        <div className="action-row" style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
          <button className="button" type="button" onClick={loadReports}>
            Apply filters
          </button>
          <button className="button secondary" type="button" onClick={handleExportExcel}>
            Export Excel
          </button>
          <button className="button secondary" type="button" onClick={handleExportPdf}>
            Export PDF
          </button>
          {workspace?.enabledModules?.includes("expenses") ? (
            <button className="button secondary" type="button" onClick={handleExportExpensesExcel}>
              Export {expenseLabel}
            </button>
          ) : null}
          {workspace?.enabledModules?.includes("sales") ? (
            <button className="button secondary" type="button" onClick={handleExportSalesExcel}>
              Export {salesLabel}
            </button>
          ) : null}
          {workspace?.enabledModules?.includes("invoices") ? (
            <button className="button secondary" type="button" onClick={handleExportInvoicesExcel}>
              Export {invoiceLabel}
            </button>
          ) : null}
          {workspace?.enabledModules?.includes("quotes") ? (
            <button className="button secondary" type="button" onClick={handleExportQuotesExcel}>
              Export {quoteLabel}
            </button>
          ) : null}
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
            {workspace?.enabledModules?.includes("quotes") ? (
              <div className="stat-card">
                <div className="muted">{quoteLabel} total</div>
                <div className="stat-value">{formatMoney(summary.quotes_total)}</div>
                <div className="muted">Count: {summary.quotes_count}</div>
              </div>
            ) : null}
            {workspace?.enabledModules?.includes("sales") ? (
              <div className="stat-card">
                <div className="muted">{salesLabel} total</div>
                <div className="stat-value">{formatMoney(summary.sales_total)}</div>
                <div className="muted">Count: {summary.sales_count}</div>
              </div>
            ) : null}
            {workspace?.enabledModules?.includes("sales") ? (
              <div className="stat-card">
                <div className="muted">{salesLabel} paid</div>
                <div className="stat-value">{formatMoney(summary.sales_paid_total)}</div>
                <div className="muted">Outstanding: {formatMoney(summary.sales_outstanding)}</div>
              </div>
            ) : null}
            {workspace?.enabledModules?.includes("invoices") ? (
              <div className="stat-card">
                <div className="muted">{invoiceLabel} billed</div>
                <div className="stat-value">{formatMoney(summary.invoices_billed_total)}</div>
                <div className="muted">Count: {summary.invoices_count}</div>
              </div>
            ) : null}
            {workspace?.enabledModules?.includes("invoices") ? (
              <div className="stat-card">
                <div className="muted">{invoiceLabel} paid</div>
                <div className="stat-value">{formatMoney(summary.invoices_paid_total)}</div>
                <div className="muted">Outstanding: {formatMoney(summary.invoices_outstanding)}</div>
              </div>
            ) : null}
            <div className="stat-card">
              <div className="muted">Expenses</div>
              <div className="stat-value">{formatMoney(summary.expenses_total)}</div>
              <div className="muted">Count: {summary.expenses_count}</div>
            </div>
            {workspace?.enabledModules?.includes("invoices") ? (
              <div className="stat-card">
                <div className="muted">Profit (paid)</div>
                <div className="stat-value">{formatMoney(summary.profit_on_paid)}</div>
                <div className="muted">Overdue: {summary.overdue_count}</div>
              </div>
            ) : null}
            {workspace?.enabledModules?.includes("invoices") ? (
              <div className="stat-card">
                <div className="muted">Profit (billed)</div>
                <div className="stat-value">{formatMoney(summary.profit_on_billed)}</div>
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
          <>
            <table className="table desktop-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Billed</th>
                  <th>Paid</th>
                  {workspace?.enabledModules?.includes("sales") ? <th>Sales</th> : null}
                  {workspace?.enabledModules?.includes("sales") ? <th>Sales Paid</th> : null}
                  <th>Expenses</th>
                </tr>
              </thead>
              <tbody>
                {series.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td>{formatMoney(row.billed)}</td>
                    <td>{formatMoney(row.paid)}</td>
                    {workspace?.enabledModules?.includes("sales") ? (
                      <td>{formatMoney(Number(row.sales || 0))}</td>
                    ) : null}
                    {workspace?.enabledModules?.includes("sales") ? (
                      <td>{formatMoney(Number(row.salesPaid || 0))}</td>
                    ) : null}
                    <td>{formatMoney(row.expenses)}</td>
                  </tr>
                ))}
                {series.length === 0 ? (
                  <tr>
                    <td colSpan={workspace?.enabledModules?.includes("sales") ? 6 : 4} className="muted">
                      No data for the selected range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="mobile-record-list">
              {series.map((row) => (
                <article key={row.month} className="mobile-record-card">
                  <div className="mobile-record-title">{row.month}</div>
                  <div className="mobile-record-grid">
                    <div className="mobile-record-item">
                      <span className="mobile-record-label">Billed</span>
                      <span>{formatMoney(row.billed)}</span>
                    </div>
                    <div className="mobile-record-item">
                      <span className="mobile-record-label">Paid</span>
                      <span>{formatMoney(row.paid)}</span>
                    </div>
                    {workspace?.enabledModules?.includes("sales") ? (
                      <div className="mobile-record-item">
                        <span className="mobile-record-label">Sales</span>
                        <span>{formatMoney(Number(row.sales || 0))}</span>
                      </div>
                    ) : null}
                    {workspace?.enabledModules?.includes("sales") ? (
                      <div className="mobile-record-item">
                        <span className="mobile-record-label">Sales paid</span>
                        <span>{formatMoney(Number(row.salesPaid || 0))}</span>
                      </div>
                    ) : null}
                    <div className="mobile-record-item">
                      <span className="mobile-record-label">Expenses</span>
                      <span>{formatMoney(row.expenses)}</span>
                    </div>
                  </div>
                </article>
              ))}
              {series.length === 0 ? <div className="muted">No data for the selected range.</div> : null}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Financial Reports</div>
        {!workspace?.enabledModules?.includes("accounting") ? (
          <div className="muted">Enable Accounting in Settings to unlock financial statements.</div>
        ) : (
          <>
            <div className="grid-2">
              <label className="field">
                Report type
                <select value={financialType} onChange={(e) => setFinancialType(e.target.value as FinancialReportType)}>
                  <option value="income">Income statement</option>
                  <option value="balance">Balance sheet</option>
                  <option value="cash">Cash flow</option>
                  <option value="trial">Trial balance</option>
                  <option value="ledger">General ledger</option>
                  <option value="tax-vat">VAT Return (VAT 100)</option>
                  <option value="tax-turnover">Turnover Tax (TOT)</option>
                </select>
              </label>
              {financialType === "balance" ? (
                <label className="field">
                  As at
                  <input value={asAt} onChange={(e) => setAsAt(e.target.value)} type="date" />
                </label>
              ) : null}
              {financialType === "trial" ? (
                <label className="field">
                  Period
                  <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                    <option value="">All periods</option>
                    {periods.map((period) => (
                      <option key={period._id} value={period._id}>
                        {period.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {financialType === "ledger" ? (
                <label className="field">
                  Account
                  <select value={ledgerAccountId} onChange={(e) => setLedgerAccountId(e.target.value)}>
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={account._id} value={account._id}>
                        {account.code ? `${account.code} · ` : ""}
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            {(financialType === "income" || financialType === "cash" || financialType.startsWith("tax")) ? (
              <div className="muted">Uses the date range from the overview filters above.</div>
            ) : null}
            <div className="action-row" style={{ marginTop: 12 }}>
              <button className="button" type="button" onClick={loadFinancialReport}>
                Run report
              </button>
            </div>
            <div style={{ marginTop: 16 }}>{renderFinancialReport()}</div>
          </>
        )}
      </section>
    </>
  );
}
