"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiDownload, apiFetch } from "@/lib/api";
import { clearToken } from "@/lib/auth";

type BranchPerf = { branchId: string; branchName: string; totalRevenue: number; invoiceCount: number; growthRate: number | null };
type EmployeePerf = { userId?: string; name: string; role?: string; totalSales: number; invoices: number; avgInvoiceValue: number };

type SuperAdminOverview = {
  overview: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    salesRevenue?: number;
    invoicesCount: number;
    salesCount?: number;
    transactionsCount?: number;
    activeBranchesCount?: number;
    companiesCount?: number;
    activeCompaniesCount?: number;
    usersCount?: number;
    activeUsersCount?: number;
    usageWindowDays?: number;
    currency?: string | null;
    companyName?: string | null;
    range: { from: string | null; to: string | null };
  };
  timeseries: { period: string; revenue: number; expenses: number; profit: number }[];
  branchPerformance: BranchPerf[];
  employeePerformance: EmployeePerf[];
};

function formatMoney(value: number, currency?: string | null) {
  const num = Number(value || 0);
  if (!currency) return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function formatDateTime(value: any) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatPct(value: any) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(0)}%`;
}

type AlertSuddenDrop = { type: "sudden_drop_in_revenue"; drop: number; previous: number; current: number };
type AlertHighInvoice = {
  type: "high_invoice";
  invoices: Array<{
    _id: string;
    invoiceNo: string;
    total: number;
    issueDate: string;
    branchName?: string;
  }>;
};
type AlertInactiveBranches = {
  type: "inactive_branches";
  branches: Array<{ _id?: string; name: string; code?: string }>;
};
type SuperAdminAlert = AlertSuddenDrop | AlertHighInvoice | AlertInactiveBranches | { type: string; [key: string]: any };

function AlertCard({
  alert,
  defaultCurrency
}: {
  alert: SuperAdminAlert;
  defaultCurrency?: string | null;
}) {
  if (alert?.type === "sudden_drop_in_revenue") {
    const a = alert as AlertSuddenDrop;
    return (
      <div className="callout warn">
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Sudden drop in revenue</div>
        <div className="muted">
          Revenue dropped {formatPct(a.drop)} vs previous period ({formatMoney(a.previous, defaultCurrency)} → {formatMoney(a.current, defaultCurrency)}).
        </div>
      </div>
    );
  }

  if (alert?.type === "high_invoice") {
    const a = alert as AlertHighInvoice;
    return (
      <div className="callout">
        <div style={{ fontWeight: 800, marginBottom: 6 }}>High invoice(s)</div>
        <div className="muted">Largest invoices in the selected period.</div>
        <div className="table-wrap">
          <table className="table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Branch</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(a.invoices || []).slice(0, 10).map((inv) => (
                <tr key={inv._id}>
                  <td>{inv.invoiceNo || "—"}</td>
                  <td>{inv.branchName || "—"}</td>
                  <td>{formatMoney(inv.total || 0, defaultCurrency || null)}</td>
                  <td>{formatDateTime(inv.issueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (alert?.type === "inactive_branches") {
    const a = alert as AlertInactiveBranches;
    return (
      <div className="callout warn">
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Inactive branches</div>
        <div className="muted">Branches with no invoices in the last 30 days.</div>
        <div className="table-wrap">
          <table className="table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {(a.branches || []).slice(0, 10).map((b, idx) => (
                <tr key={b._id || `${b.name}-${idx}`}>
                  <td>{b.name || "—"}</td>
                  <td>{b.code || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="callout">
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{String(alert?.type || "alert")}</div>
      <details>
        <summary className="muted" style={{ cursor: "pointer" }}>
          Details
        </summary>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, color: "var(--muted)" }}>
          {JSON.stringify(alert, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ role?: string; name?: string; email?: string } | null>(null);
  const [data, setData] = useState<SuperAdminOverview | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month" | "quarter">("month");
  const [range, setRange] = useState({ from: "", to: "" });
  const [downloading, setDownloading] = useState(false);
  const [pushTarget, setPushTarget] = useState<"owners_admins" | "all">("owners_admins");
  const [pushSeverity, setPushSeverity] = useState<"info" | "warning" | "danger">("info");
  const [pushMessage, setPushMessage] = useState("");
  const [pushUrl, setPushUrl] = useState("/notifications");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState<string>("");

  const currency = data?.overview?.currency || null;

  const logout = () => {
    clearToken();
    router.push("/login");
  };

  const loadMe = async () => {
    const res = await apiFetch<{ user: { role?: string; name?: string; email?: string } }>("/api/auth/me");
    setMe(res.user);
    if (res.user?.role !== "super_admin") {
      clearToken();
      router.push("/login");
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("groupBy", period);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);

      const [overview, alertsRes] = await Promise.all([
        apiFetch<SuperAdminOverview>(`/api/admin/overview?${params.toString()}`),
        apiFetch<{ alerts: any[] }>(`/api/admin/alerts?${params.toString()}`)
      ]);
      setData(overview);
      setAlerts(alertsRes.alerts || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe().catch(() => {
      clearToken();
      router.push("/login");
    });
  }, [router]);

  useEffect(() => {
    const now = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(now.getMonth() - 1);
    setRange({ from: lastMonth.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) });
  }, []);

  useEffect(() => {
    if (!me || me.role !== "super_admin") return;
    if (!range.from || !range.to) return;
    loadDashboard();
  }, [me?.role, range.from, range.to, period]);

  const exportReport = async (kind: "overview_csv" | "is_csv" | "is_xlsx" | "is_pdf") => {
    if (downloading) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set("groupBy", period);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);

      if (kind === "overview_csv") {
        await apiDownload(`/api/admin/reports/overview/export.csv?${params.toString()}`, "super-admin-overview.csv");
      } else if (kind === "is_csv") {
        await apiDownload(`/api/admin/reports/income-statement/export.csv?${params.toString()}`, "income-statement.csv");
      } else if (kind === "is_xlsx") {
        await apiDownload(`/api/admin/reports/income-statement/export.xlsx?${params.toString()}`, "income-statement.xlsx");
      } else {
        await apiDownload(`/api/admin/reports/income-statement/export.pdf?${params.toString()}`, "income-statement.pdf");
      }
    } finally {
      setDownloading(false);
    }
  };

  const sendPush = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pushSending) return;
    setPushSending(true);
    setPushResult("");
    try {
      const roles = pushTarget === "all" ? ["owner", "admin", "member"] : ["owner", "admin"];
      const res = await apiFetch<{ recipients: number; pushEnabled: boolean; push: { sent: number; failed: number } }>(
        "/api/admin/push/send",
        {
          method: "POST",
          body: JSON.stringify({
            roles,
            severity: pushSeverity,
            type: "admin_alert",
            message: pushMessage,
            url: pushUrl || "/notifications",
            title: "Admin Alert",
            createInApp: true
          })
        }
      );
      setPushMessage("");
      setPushResult(
        res.pushEnabled
          ? `Sent to ${res.recipients} user(s) (push: ${res.push.sent} sent, ${res.push.failed} failed).`
          : `Sent in-app to ${res.recipients} user(s). Push is not configured on the server.`
      );
    } catch (err: any) {
      setPushResult(err?.message || "Failed to send alert");
    } finally {
      setPushSending(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-title">{data?.overview?.companyName ? `${data.overview.companyName} · Admin Console` : "Admin Console"}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Usage, performance, and analytics across branches
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="badge">{me?.email || "—"}</span>
          <button className="button danger" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-title">Filters</div>
        <div className="muted" style={{ marginTop: 6 }}>
          {data?.overview.companyName ? `Company: ${data.overview.companyName}` : "Company analytics"}
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div className="grid-2">
            <label className="field">
              From
              <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            </label>
            <label className="field">
              To
              <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
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
            <div />
          </div>
          <div className="actions-row">
            <button className="button secondary" type="button" onClick={loadDashboard} disabled={loading}>
              Refresh
            </button>
            <button className="button secondary" type="button" onClick={() => exportReport("overview_csv")} disabled={downloading}>
              Export overview CSV
            </button>
            <button className="button secondary" type="button" onClick={() => exportReport("is_csv")} disabled={downloading}>
              Export income CSV
            </button>
            <button className="button secondary" type="button" onClick={() => exportReport("is_xlsx")} disabled={downloading}>
              Export income XLSX
            </button>
            <button className="button secondary" type="button" onClick={() => exportReport("is_pdf")} disabled={downloading}>
              Export income PDF
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="callout error" style={{ marginTop: 12 }}>{error}</div> : null}

      {loading ? (
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="muted">Loading…</div>
        </div>
      ) : (
        <>
          <section className="panel" style={{ marginTop: 12 }}>
            <div className="panel-title">Send Alert</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Sends an in-app notification, plus push (if configured) to users' devices.
            </div>
            <form onSubmit={sendPush} style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <div className="grid-2">
                <label className="field">
                  Recipients
                  <select value={pushTarget} onChange={(e) => setPushTarget(e.target.value as any)}>
                    <option value="owners_admins">Owners & Admins</option>
                    <option value="all">All users</option>
                  </select>
                </label>
                <label className="field">
                  Severity
                  <select value={pushSeverity} onChange={(e) => setPushSeverity(e.target.value as any)}>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="danger">Danger</option>
                  </select>
                </label>
              </div>
              <label className="field">
                Link (optional)
                <input value={pushUrl} onChange={(e) => setPushUrl(e.target.value)} placeholder="/notifications" />
              </label>
              <label className="field">
                Message
                <input value={pushMessage} onChange={(e) => setPushMessage(e.target.value)} required />
              </label>
              {pushResult ? <div className="callout">{pushResult}</div> : null}
              <button className="button" type="submit" disabled={pushSending}>
                {pushSending ? "Sending…" : "Send alert"}
              </button>
            </form>
          </section>

          <div className="grid-3" style={{ marginTop: 12 }}>
            <section className="panel">
              <div className="muted">Total revenue</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{formatMoney(data?.overview.totalRevenue || 0, currency)}</div>
              <div className="muted" style={{ marginTop: 6 }}>Invoices only</div>
            </section>
            <section className="panel">
              <div className="muted">Total expenses</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{formatMoney(data?.overview.totalExpenses || 0, currency)}</div>
              <div className="muted" style={{ marginTop: 6 }}>Expenses module</div>
            </section>
            <section className="panel">
              <div className="muted">Net profit</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{formatMoney(data?.overview.netProfit || 0, currency)}</div>
              <div className="muted" style={{ marginTop: 6 }}>Revenue − expenses</div>
            </section>
          </div>

          <div className="grid-3" style={{ marginTop: 12 }}>
            <section className="panel">
              <div className="muted">Transactions</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{data?.overview.transactionsCount ?? "—"}</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Invoices: {data?.overview.invoicesCount ?? 0} · Sales: {data?.overview.salesCount ?? 0}
              </div>
            </section>
            <section className="panel">
              <div className="muted">System usage (last {data?.overview.usageWindowDays ?? 30} days)</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>
                {data?.overview.activeUsersCount ?? "—"} active users
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Total users: {data?.overview.usersCount ?? "—"}
              </div>
            </section>
            <section className="panel">
              <div className="muted">Branches</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>
                {data?.overview.activeBranchesCount ?? "—"} active branches
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Ranked by revenue below
              </div>
            </section>
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <section className="panel">
              <div className="panel-title">Revenue & expenses trend</div>
              <div style={{ width: "100%", height: 280, marginTop: 10 }}>
                <ResponsiveContainer>
                  <AreaChart data={data?.timeseries || []}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6ea8ff" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6ea8ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="period" stroke="rgba(255,255,255,0.6)" />
                    <YAxis stroke="rgba(255,255,255,0.6)" />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="#6ea8ff" fill="url(#rev)" />
                    <Area type="monotone" dataKey="expenses" stroke="#fb7185" fillOpacity={0.12} fill="#fb7185" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">Profit trend</div>
              <div style={{ width: "100%", height: 280, marginTop: 10 }}>
                <ResponsiveContainer>
                  <BarChart data={data?.timeseries || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="period" stroke="rgba(255,255,255,0.6)" />
                    <YAxis stroke="rgba(255,255,255,0.6)" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="profit" fill="#34d399" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <section className="panel">
              <div className="panel-title">Branch performance</div>
              <div className="muted" style={{ marginTop: 6 }}>Ranked by invoice revenue.</div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Revenue</th>
                      <th>Invoices</th>
                      <th>Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.branchPerformance || []).slice(0, 15).map((b) => (
                      <tr key={String(b.branchId)}>
                        <td>{b.branchName}</td>
                        <td>{formatMoney(b.totalRevenue, currency)}</td>
                        <td>{b.invoiceCount}</td>
                        <td>{b.growthRate === null ? "—" : `${b.growthRate}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">Employee productivity</div>
              <div className="muted" style={{ marginTop: 6 }}>Ranked by invoice revenue per salesperson.</div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Revenue</th>
                      <th>Invoices</th>
                      <th>Avg invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.employeePerformance || []).slice(0, 15).map((e, idx) => (
                      <tr key={e.userId || `${e.name}-${idx}`}>
                        <td>{e.name}</td>
                        <td>{formatMoney(e.totalSales, currency)}</td>
                        <td>{e.invoices}</td>
                        <td>{formatMoney(e.avgInvoiceValue || 0, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="panel" style={{ marginTop: 12 }}>
            <div className="panel-title">Alerts</div>
            {alerts.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {(alerts as SuperAdminAlert[]).map((a, idx) => (
                  <AlertCard key={idx} alert={a} defaultCurrency={currency} />
                ))}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 10 }}>
                No alerts.
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
