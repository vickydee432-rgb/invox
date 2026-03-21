"use client";

import { useEffect, useMemo, useState } from "react";
import { apiDownload, apiFetch } from "@/lib/api";
import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";
import PieChart from "@/components/charts/PieChart";

type GroupBy = "month" | "quarter" | "year";
type TabKey = "income" | "balance" | "cash";

type IncomeSeriesRow = { period: string; revenue: number; expenses: number; profit: number };
type ExpenseCategoryRow = { category: string; total: number; count: number };

type DashboardResponse = {
  range: { from: string | null; to: string | null };
  summary: { totalRevenue: number; totalExpenses: number; netProfit: number; cashBalance: number };
  incomeStatement: {
    totals: { totalRevenue: number; totalExpenses: number; netProfit: number };
    comparison: null | {
      previousRange: { from: string; to: string };
      previousTotals: { totalRevenue: number; totalExpenses: number; netProfit: number };
      deltas: { revenue: number; expenses: number; netProfit: number };
    };
    breakdown: { expensesByCategory: ExpenseCategoryRow[] };
    series: IncomeSeriesRow[];
  };
  cashFlow: {
    cashIn: number;
    cashOut: number;
    netCashFlow: number;
    openingCash: number;
    closingCash: number;
    cashSource: string;
    cashInComponents?: { payments: number; paidInvoicesLegacy: number };
  };
  balanceSheet: {
    asAt: string;
    assets: { cash: number; accountsReceivable: number; total: number };
    liabilities: { obligations: number; total: number };
    equity: { ownerEquity: number; retainedEarnings: number; total: number };
    balanced: boolean;
    balanceDiff: number;
    cashSource?: string;
  };
};

type IncomeDetailResponse = {
  range: { from: string | null; to: string | null };
  totals: { totalRevenue: number; totalExpenses: number; netProfit: number };
  comparison: DashboardResponse["incomeStatement"]["comparison"];
  breakdown: {
    revenueByInvoice: {
      _id: string;
      invoiceNo: string;
      customerName: string;
      issueDate: string;
      status: string;
      total: number;
      amountPaid: number;
      balance: number;
    }[];
    expensesByCategory: ExpenseCategoryRow[];
  };
  series: IncomeSeriesRow[];
};

const formatMoney = (value: number) => Number(value || 0).toFixed(2);

function toISODateLocal(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfQuarter(date: Date) {
  const qStartMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), qStartMonth, 1);
}

export default function FinancialReportsPage() {
  const [tab, setTab] = useState<TabKey>("income");
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [incomeDetail, setIncomeDetail] = useState<IncomeDetailResponse | null>(null);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeError, setIncomeError] = useState("");

  useEffect(() => {
    const now = new Date();
    setTo(toISODateLocal(now));
    setFrom(toISODateLocal(new Date(now.getFullYear(), now.getMonth(), 1)));
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("groupBy", groupBy);
      const data = await apiFetch<DashboardResponse>(`/api/financial-reports/dashboard?${params.toString()}`);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || "Failed to load financial dashboard");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  const loadIncomeDetail = async () => {
    if (tab !== "income") return;
    setIncomeLoading(true);
    setIncomeError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("groupBy", groupBy);
      params.set("limit", "300");
      const data = await apiFetch<IncomeDetailResponse>(`/api/financial-reports/income-statement?${params.toString()}`);
      setIncomeDetail(data);
    } catch (err: any) {
      setIncomeError(err.message || "Failed to load income statement details");
      setIncomeDetail(null);
    } finally {
      setIncomeLoading(false);
    }
  };

  useEffect(() => {
    if (!from && !to) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, groupBy]);

  useEffect(() => {
    loadIncomeDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, from, to, groupBy]);

  const profitPoints = useMemo(() => {
    const rows = dashboard?.incomeStatement?.series || [];
    return rows.map((r) => ({ label: r.period, value: r.profit }));
  }, [dashboard]);

  const barRows = useMemo(() => {
    const rows = dashboard?.incomeStatement?.series || [];
    return rows.map((r) => ({ label: r.period, a: r.revenue, b: r.expenses }));
  }, [dashboard]);

  const pieSlices = useMemo(() => {
    const rows = dashboard?.incomeStatement?.breakdown?.expensesByCategory || [];
    return rows.slice(0, 8).map((r) => ({ label: r.category, value: r.total }));
  }, [dashboard]);

  const applyPreset = (preset: "month" | "quarter" | "year") => {
    const now = new Date();
    if (preset === "month") {
      setFrom(toISODateLocal(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(toISODateLocal(now));
      setGroupBy("month");
      return;
    }
    if (preset === "quarter") {
      setFrom(toISODateLocal(startOfQuarter(now)));
      setTo(toISODateLocal(now));
      setGroupBy("quarter");
      return;
    }
    setFrom(toISODateLocal(new Date(now.getFullYear(), 0, 1)));
    setTo(toISODateLocal(now));
    setGroupBy("year");
  };

  const handleExport = async (format: "pdf" | "csv" | "xlsx") => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (tab === "income") {
      params.set("groupBy", groupBy);
      const path = `/api/financial-reports/income-statement/export.${format}?${params.toString()}`;
      await apiDownload(path, `income_statement_${from || "any"}_${to || "any"}.${format}`);
      return;
    }
    if (tab === "balance") {
      const path = `/api/financial-reports/balance-sheet/export.${format}?asAt=${encodeURIComponent(to || "")}`;
      await apiDownload(path, `balance_sheet_${to || toISODateLocal(new Date())}.${format}`);
      return;
    }
    const path = `/api/financial-reports/cash-flow/export.${format}?${params.toString()}`;
    await apiDownload(path, `cash_flow_${from || "any"}_${to || "any"}.${format}`);
  };

  return (
    <section className="panel">
      <div className="dashboard-toolbar">
        <div>
          <div className="panel-title">Financial Reports</div>
          <div className="muted">Income Statement · Balance Sheet · Cash Flow</div>
        </div>
        <div className="dashboard-toolbar-actions">
          <label className="field dashboard-field">
            Group
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </label>
          <button className="button secondary" type="button" onClick={() => applyPreset("month")}>
            This month
          </button>
          <button className="button secondary" type="button" onClick={() => applyPreset("quarter")}>
            This quarter
          </button>
          <button className="button secondary" type="button" onClick={() => applyPreset("year")}>
            This year
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <label className="field">
          From
          <input value={from} onChange={(e) => setFrom(e.target.value)} type="date" />
        </label>
        <label className="field">
          To
          <input value={to} onChange={(e) => setTo(e.target.value)} type="date" />
        </label>
      </div>

      <div className="report-actions">
        <div className="tab-row">
          <button className={`tab${tab === "income" ? " active" : ""}`} type="button" onClick={() => setTab("income")}>
            Income Statement
          </button>
          <button className={`tab${tab === "balance" ? " active" : ""}`} type="button" onClick={() => setTab("balance")}>
            Balance Sheet
          </button>
          <button className={`tab${tab === "cash" ? " active" : ""}`} type="button" onClick={() => setTab("cash")}>
            Cash Flow
          </button>
        </div>
        <div className="export-row">
          <button className="button secondary" type="button" onClick={() => handleExport("pdf")}>
            Export PDF
          </button>
          <button className="button secondary" type="button" onClick={() => handleExport("csv")}>
            Export CSV
          </button>
          <button className="button secondary" type="button" onClick={() => handleExport("xlsx")}>
            Export Excel
          </button>
        </div>
      </div>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
      {loading || !dashboard ? (
        <div className="muted" style={{ marginTop: 12 }}>Loading financial reports...</div>
      ) : (
        <>
          <div className="dashboard-cards" style={{ marginTop: 14 }}>
            <div className="stat-card dashboard-card">
              <div className="muted">Total Revenue</div>
              <div className="stat-value">{formatMoney(dashboard.summary.totalRevenue)}</div>
              {dashboard.incomeStatement.comparison ? (
                <div className="muted">Δ {formatMoney(dashboard.incomeStatement.comparison.deltas.revenue)}</div>
              ) : null}
            </div>
            <div className="stat-card dashboard-card">
              <div className="muted">Total Expenses</div>
              <div className="stat-value">{formatMoney(dashboard.summary.totalExpenses)}</div>
              {dashboard.incomeStatement.comparison ? (
                <div className="muted">Δ {formatMoney(dashboard.incomeStatement.comparison.deltas.expenses)}</div>
              ) : null}
            </div>
            <div className="stat-card dashboard-card">
              <div className="muted">Net Profit</div>
              <div className="stat-value">{formatMoney(dashboard.summary.netProfit)}</div>
              {dashboard.incomeStatement.comparison ? (
                <div className="muted">Δ {formatMoney(dashboard.incomeStatement.comparison.deltas.netProfit)}</div>
              ) : null}
            </div>
            <div className="stat-card dashboard-card">
              <div className="muted">Cash Balance</div>
              <div className="stat-value">{formatMoney(dashboard.summary.cashBalance)}</div>
              <div className="muted">
                AR: {formatMoney(dashboard.balanceSheet.assets.accountsReceivable)} · Liab:{" "}
                {formatMoney(dashboard.balanceSheet.liabilities.total)}
              </div>
            </div>
          </div>

          <div className="chart-grid" style={{ marginTop: 14 }}>
            <div className="panel chart-panel">
              <div className="panel-title">Profit over time</div>
              <LineChart points={profitPoints} />
            </div>
            <div className="panel chart-panel">
              <div className="panel-title">Revenue vs expenses</div>
              <BarChart rows={barRows} />
            </div>
            <div className="panel chart-panel">
              <div className="panel-title">Expense categories</div>
              <PieChart slices={pieSlices} />
            </div>
          </div>

          {tab === "income" ? (
            <div className="panel" style={{ marginTop: 14 }}>
              <div className="panel-title">Income Statement (Details)</div>
              {incomeError ? <div className="muted">{incomeError}</div> : null}
              {incomeLoading || !incomeDetail ? (
                <div className="muted">Loading income statement...</div>
              ) : (
                <>
                  <div className="grid-3" style={{ marginTop: 12 }}>
                    <div className="stat-card">
                      <div className="muted">Revenue</div>
                      <div className="stat-value">{formatMoney(incomeDetail.totals.totalRevenue)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="muted">Expenses</div>
                      <div className="stat-value">{formatMoney(incomeDetail.totals.totalExpenses)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="muted">Net Profit</div>
                      <div className="stat-value">{formatMoney(incomeDetail.totals.netProfit)}</div>
                    </div>
                  </div>

                  <div className="table-wrap" style={{ marginTop: 14 }}>
                    <table className="table desktop-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Customer</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeDetail.breakdown.revenueByInvoice.length ? (
                          incomeDetail.breakdown.revenueByInvoice.map((inv) => (
                            <tr key={inv._id}>
                              <td>{inv.invoiceNo}</td>
                              <td>{inv.customerName}</td>
                              <td>{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : ""}</td>
                              <td>{inv.status}</td>
                              <td>{formatMoney(inv.total)}</td>
                              <td>{formatMoney(inv.amountPaid)}</td>
                              <td>{formatMoney(inv.balance)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="muted">
                              No invoices in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="table-wrap" style={{ marginTop: 14 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Expense Category</th>
                          <th>Total</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeDetail.breakdown.expensesByCategory.length ? (
                          incomeDetail.breakdown.expensesByCategory.map((row) => (
                            <tr key={row.category}>
                              <td>{row.category}</td>
                              <td>{formatMoney(row.total)}</td>
                              <td>{row.count}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="muted">
                              No expenses in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {tab === "balance" ? (
            <div className="panel" style={{ marginTop: 14 }}>
              <div className="panel-title">Balance Sheet</div>
              <div className="muted">As at {new Date(dashboard.balanceSheet.asAt).toLocaleDateString()}</div>

              <div className="grid-3" style={{ marginTop: 12 }}>
                <div className="stat-card">
                  <div className="muted">Cash</div>
                  <div className="stat-value">{formatMoney(dashboard.balanceSheet.assets.cash)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Accounts Receivable</div>
                  <div className="stat-value">{formatMoney(dashboard.balanceSheet.assets.accountsReceivable)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Total Assets</div>
                  <div className="stat-value">{formatMoney(dashboard.balanceSheet.assets.total)}</div>
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: 12 }}>
                <div className="stat-card">
                  <div className="muted">Liabilities (Obligations)</div>
                  <div className="stat-value">{formatMoney(dashboard.balanceSheet.liabilities.total)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Equity</div>
                  <div className="stat-value">{formatMoney(dashboard.balanceSheet.equity.total)}</div>
                  <div className="muted">
                    Retained: {formatMoney(dashboard.balanceSheet.equity.retainedEarnings)} · Owner:{" "}
                    {formatMoney(dashboard.balanceSheet.equity.ownerEquity)}
                  </div>
                </div>
              </div>

              <div className="muted" style={{ marginTop: 10 }}>
                Balanced: {dashboard.balanceSheet.balanced ? "Yes" : "No"} · Diff:{" "}
                {formatMoney(dashboard.balanceSheet.balanceDiff)}
              </div>
            </div>
          ) : null}

          {tab === "cash" ? (
            <div className="panel" style={{ marginTop: 14 }}>
              <div className="panel-title">Cash Flow Summary (Simplified)</div>
              <div className="muted">
                Opening vs Closing cash · Source: {dashboard.cashFlow.cashSource}
              </div>
              <div className="grid-3" style={{ marginTop: 12 }}>
                <div className="stat-card">
                  <div className="muted">Cash In</div>
                  <div className="stat-value">{formatMoney(dashboard.cashFlow.cashIn)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Cash Out</div>
                  <div className="stat-value">{formatMoney(dashboard.cashFlow.cashOut)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Net Cash Flow</div>
                  <div className="stat-value">{formatMoney(dashboard.cashFlow.netCashFlow)}</div>
                </div>
              </div>
              <div className="grid-2" style={{ marginTop: 12 }}>
                <div className="stat-card">
                  <div className="muted">Opening Cash</div>
                  <div className="stat-value">{formatMoney(dashboard.cashFlow.openingCash)}</div>
                </div>
                <div className="stat-card">
                  <div className="muted">Closing Cash</div>
                  <div className="stat-value">{formatMoney(dashboard.cashFlow.closingCash)}</div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

