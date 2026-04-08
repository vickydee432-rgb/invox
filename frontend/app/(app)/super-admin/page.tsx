"use client";

import { useEffect, useMemo, useState } from "react";
import { apiDownload, apiFetch } from "@/lib/api";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

type BranchPerf = {
  branchId: string;
  branchName: string;
  totalRevenue: number;
  invoiceCount: number;
  growthRate: number | null;
};
type EmployeePerf = { userId?: string; name: string; totalSales: number; invoices: number; avgInvoiceValue: number };
type ProductInsight = { name: string; revenue: number; quantity: number };

type CompanyOption = {
  _id: string;
  name: string;
  email?: string;
  currency?: string | null;
  subscriptionStatus?: string;
  subscriptionPlan?: string | null;
  subscriptionCycle?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  createdAt?: string;
};

type SuperAdminOverview = {
  overview: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    invoicesCount: number;
    activeBranchesCount: number;
    companiesCount?: number;
    currency?: string | null;
    range: { from: string | null; to: string | null };
  };
  branchPerformance: BranchPerf[];
  employeePerformance: EmployeePerf[];
  productInsights: ProductInsight[];
  timeseries: { period: string; revenue: number; expenses: number; profit: number }[];
  alerts: any[];
};

function formatMoney(value: number, currency?: string | null) {
  const num = Number(value || 0);
  if (!currency) {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export default function SuperAdminDashboard() {
  const [me, setMe] = useState<{ role?: string; name?: string; email?: string } | null>(null);
  const [data, setData] = useState<SuperAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month" | "quarter">("month");
  const [range, setRange] = useState({ from: "", to: "" });
  const [companyId, setCompanyId] = useState<string>("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState("");

  const currency = data?.overview?.currency || null;

  const loadMe = async () => {
    try {
      const res = await apiFetch<{ user: { role?: string; name?: string; email?: string } }>("/api/auth/me");
      setMe(res.user);
    } catch {
      setMe(null);
    }
  };

  const loadCompanies = async (q: string) => {
    setCompaniesLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "50");
      const res = await apiFetch<{ companies: CompanyOption[] }>(`/api/admin/console/companies?${params.toString()}`);
      setCompanies(res.companies || []);
    } catch {
      setCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  };

  const fetchDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("groupBy", period);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (companyId) params.set("companyId", companyId);
      const [overview, alerts] = await Promise.all([
        apiFetch<SuperAdminOverview>(`/api/admin/overview?${params.toString()}`),
        apiFetch<{ alerts: any[] }>(`/api/admin/alerts?${params.toString()}`)
      ]);
      setData({ ...overview, alerts: alerts.alerts || [] });
    } catch (err: any) {
      setError(err?.message || "Failed to load super admin analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    if (me?.role !== "super_admin") return;
    loadCompanies("");
  }, [me?.role]);

  useEffect(() => {
    if (me?.role !== "super_admin") return;
    const handle = window.setTimeout(() => {
      loadCompanies(companyQuery);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [companyQuery, me?.role]);

  useEffect(() => {
    const now = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(now.getMonth() - 1);
    setRange({ from: lastMonth.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) });
  }, []);

  useEffect(() => {
    if (!range.from || !range.to) return;
    if (!me || me.role !== "super_admin") return;
    fetchDashboard();
  }, [period, range.from, range.to, companyId, me?.role]);

  const alerts = useMemo(() => data?.alerts || [], [data]);

  if (me && me.role !== "super_admin") {
    return (
      <section className="panel">
        <div className="panel-title">Super Admin</div>
        <div className="muted">You don’t have access to this page.</div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="panel">
        <div className="panel-title">Super Admin Dashboard</div>
        <div className="muted">Loading…</div>
      </section>
    );
  }
  if (error) {
    return (
      <section className="panel">
        <div className="panel-title">Super Admin Dashboard</div>
        <div className="muted" style={{ color: "var(--error-color, red)" }}>
          {error}
        </div>
      </section>
    );
  }

  const handleExport = async (kind: "overview_csv" | "is_csv" | "is_xlsx" | "is_pdf") => {
    if (downloading) return;
    setExportError("");
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set("groupBy", period);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (companyId) params.set("companyId", companyId);

      if (kind === "overview_csv") {
        await apiDownload(`/api/admin/reports/overview/export.csv?${params.toString()}`, "super-admin-overview.csv");
      } else if (kind === "is_csv") {
        await apiDownload(
          `/api/admin/reports/income-statement/export.csv?${params.toString()}`,
          "super-admin-income-statement.csv"
        );
      } else if (kind === "is_xlsx") {
        await apiDownload(
          `/api/admin/reports/income-statement/export.xlsx?${params.toString()}`,
          "super-admin-income-statement.xlsx"
        );
      } else {
        await apiDownload(
          `/api/admin/reports/income-statement/export.pdf?${params.toString()}`,
          "super-admin-income-statement.pdf"
        );
      }
    } catch (e: any) {
      setExportError(e?.message || "Export failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="panel">
        <div className="panel-title">Super Admin Dashboard</div>
        <div className="muted">
          {companyId
            ? `Company scoped · Currency ${currency || "—"}`
            : "All companies (totals may be mixed across currencies)"}
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div className="grid-2">
            <label className="field">
              From
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </label>
            <label className="field">
              To
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid-2">
            <label className="field">
              Group by
              <select value={period} onChange={(e) => setPeriod(e.target.value as any)}>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
              </select>
            </label>
            <label className="field">
              Company (optional)
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">All companies</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.currency ? `· ${c.currency}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            Search companies
            <input
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
              placeholder="Type a company name or email…"
            />
            {companiesLoading ? <span className="muted">Searching…</span> : null}
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button secondary" type="button" onClick={fetchDashboard} disabled={loading}>
              Refresh
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => handleExport("overview_csv")}
              disabled={downloading}
            >
              {downloading ? "Preparing…" : "Export overview CSV"}
            </button>
            <button className="button secondary" type="button" onClick={() => handleExport("is_csv")} disabled={downloading}>
              Export income CSV
            </button>
            <button className="button secondary" type="button" onClick={() => handleExport("is_xlsx")} disabled={downloading}>
              Export income XLSX
            </button>
            <button className="button secondary" type="button" onClick={() => handleExport("is_pdf")} disabled={downloading}>
              Export income PDF
            </button>
          </div>
          {exportError ? (
            <div className="muted" style={{ color: "var(--error-color, red)" }}>
              {exportError}
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Overview</div>
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="panel-subtle">
            <div className="muted">Total revenue</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(data?.overview.totalRevenue || 0, currency)}</div>
          </div>
          <div className="panel-subtle">
            <div className="muted">Total expenses</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(data?.overview.totalExpenses || 0, currency)}</div>
          </div>
          <div className="panel-subtle">
            <div className="muted">Net profit</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(data?.overview.netProfit || 0, currency)}</div>
          </div>
          <div className="panel-subtle">
            <div className="muted">Invoices</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{data?.overview.invoicesCount || 0}</div>
          </div>
          <div className="panel-subtle">
            <div className="muted">Active branches</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{data?.overview.activeBranchesCount || 0}</div>
          </div>
          <div className="panel-subtle">
            <div className="muted">Companies</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{data?.overview.companiesCount ?? "—"}</div>
          </div>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Range: {data?.overview.range.from || "—"} to {data?.overview.range.to || "—"}
        </div>
      </section>

      <div className="grid-2">
        <section className="panel chart-panel">
          <div className="panel-title">Revenue & Expenses</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={data?.timeseries || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success-color, #10B981)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--success-color, #10B981)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="var(--success-color, #10B981)" fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="expenses" stroke="var(--error-color, #EF4444)" fillOpacity={0.12} fill="var(--error-color, #EF4444)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="panel-title">Profit</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={data?.timeseries || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="profit" fill="var(--accent, #3B82F6)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid-3">
        <section className="panel">
          <div className="panel-title">Top Branches</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {(data?.branchPerformance || []).slice(0, 8).map((branch) => (
              <div key={branch.branchId} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{branch.branchName}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {branch.invoiceCount} invoices{branch.growthRate !== null ? ` · ${branch.growthRate}%` : ""}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{formatMoney(branch.totalRevenue, currency)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">Top Employees</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {(data?.employeePerformance || []).slice(0, 8).map((employee, idx) => (
              <div
                key={employee.userId || `${employee.name}-${idx}`}
                style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{employee.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {employee.invoices} invoices · avg {formatMoney(employee.avgInvoiceValue || 0, currency)}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{formatMoney(employee.totalSales, currency)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">Top Products</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {(data?.productInsights || []).slice(0, 8).map((product) => (
              <div key={product.name} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{product.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{product.quantity} sold</div>
                </div>
                <div style={{ fontWeight: 700 }}>{formatMoney(product.revenue, currency)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-title">Alerts</div>
        {alerts.length ? (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {alerts.map((alert, idx) => (
              <div key={idx} className="panel-subtle">
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(alert, null, 2)}</pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 10 }}>
            No alerts.
          </div>
        )}
      </section>
    </div>
  );
}
