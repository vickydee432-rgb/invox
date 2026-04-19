"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";
import { startViewTransition } from "@/lib/viewTransition";

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

type PeriodKey = "all" | "today" | "week" | "month" | "custom";

type ActivityItem = {
  key: string;
  kind: "invoice" | "expense" | "sale" | "stock";
  title: string;
  subtitle: string;
  amount?: number;
  occurredAt: Date;
  href: string;
};

type TaxDeadline = {
  _id: string;
  taxType: string;
  title: string;
  dueDate: string;
  status?: string;
};

const formatMoney = (value: number) => value.toFixed(2);

function toISODateLocal(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

export default function DashboardPage() {
  const router = useRouter();
  const pullStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const pullingRef = useRef(false);
  const [pullY, setPullY] = useState(0);
  const [ptrDragging, setPtrDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [retailSummary, setRetailSummary] = useState<ReportData["retail"]>(null);
  const [inventorySummary, setInventorySummary] = useState<{ lowStockCount: number; stockValue: number } | null>(
    null
  );
  const [recentInvoices, setRecentInvoices] = useState<
    { _id: string; customerName: string; total: number; issueDate: string }[]
  >([]);
  const [recentExpenses, setRecentExpenses] = useState<{ _id: string; title: string; amount: number; date: string }[]>(
    []
  );
  const [recentSales, setRecentSales] = useState<
    { _id: string; customerName: string; total: number; issueDate: string }[]
  >([]);
  const [recentMovements, setRecentMovements] = useState<
    {
      _id: string;
      type: string;
      qty: number;
      createdAt: string;
      productId?: { name?: string; sku?: string };
      branchId?: { name?: string; code?: string };
    }[]
  >([]);
  const [taxDeadlines, setTaxDeadlines] = useState<TaxDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("month");
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

  const refreshAll = async () => {
    const ws = await apiFetch<{ company: any }>("/api/company/me")
      .then((data) => {
        setCompany(data.company);
        const nextWs = buildWorkspace(data.company);
        setWorkspace(nextWs);
        return nextWs;
      })
      .catch(() => workspace);

    const tasks: Promise<any>[] = [];
    tasks.push(loadDashboard(fromDate, toDate));

    if (ws?.enabledModules.includes("invoices")) {
      tasks.push(
        apiFetch<{ invoices: { _id: string; customerName: string; total: number; issueDate: string }[] }>(
          "/api/invoices?limit=4&page=1"
        )
          .then((data) => setRecentInvoices(data.invoices || []))
          .catch(() => setRecentInvoices([]))
      );
    } else {
      setRecentInvoices([]);
    }

    if (ws?.enabledModules.includes("expenses")) {
      tasks.push(
        apiFetch<{ expenses: { _id: string; title: string; amount: number; date: string }[] }>(
          "/expenses?limit=4&page=1&sortBy=date&sortDir=desc"
        )
          .then((data) => setRecentExpenses(data.expenses || []))
          .catch(() => setRecentExpenses([]))
      );
    } else {
      setRecentExpenses([]);
    }

    if (ws?.enabledModules.includes("sales")) {
      tasks.push(
        apiFetch<{ sales: { _id: string; customerName: string; total: number; issueDate: string }[] }>(
          "/api/sales?limit=4&page=1"
        )
          .then((data) => setRecentSales(data.sales || []))
          .catch(() => setRecentSales([]))
      );
    } else {
      setRecentSales([]);
    }

    if (ws?.inventoryEnabled) {
      tasks.push(
        apiFetch<{ movements: any[] }>("/api/stock/movements?limit=5&page=1")
          .then((data) => setRecentMovements((data.movements || []) as any))
          .catch(() => setRecentMovements([]))
      );
      tasks.push(
        apiFetch<{ stock: { onHand?: number; avgCost?: number; lowStock?: boolean }[] }>("/api/stock")
          .then((data) => {
            const rows = data.stock || [];
            const lowStockCount = rows.reduce((sum, row) => sum + (row.lowStock ? 1 : 0), 0);
            const stockValue = rows.reduce((sum, row) => sum + Number(row.onHand || 0) * Number(row.avgCost || 0), 0);
            setInventorySummary({ lowStockCount, stockValue });
          })
          .catch(() => setInventorySummary(null))
      );
    } else {
      setRecentMovements([]);
      setInventorySummary(null);
    }

    if (ws?.enabledModules.includes("tax")) {
      tasks.push(
        apiFetch<{ deadlines: TaxDeadline[] }>("/api/tax/deadlines")
          .then((data) => setTaxDeadlines(data.deadlines || []))
          .catch(() => setTaxDeadlines([]))
      );
    } else {
      setTaxDeadlines([]);
    }

    await Promise.allSettled(tasks);
  };

  useEffect(() => {
    if (!pullY) return;
    const t = setTimeout(() => {
      if (!pullingRef.current) setPullY(0);
    }, 900);
    return () => clearTimeout(t);
  }, [pullY]);

  useEffect(() => {
    const now = new Date();
    const presetFrom = toISODateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
    const presetTo = toISODateLocal(now);
    setFromDate(presetFrom);
    setToDate(presetTo);
    loadDashboard(presetFrom, presetTo);
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => {
        if (!active) return;
        setCompany(data.company);
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

  useEffect(() => {
    if (!workspace?.enabledModules.includes("expenses")) {
      setRecentExpenses([]);
      return;
    }
    let active = true;
    apiFetch<{ expenses: { _id: string; title: string; amount: number; date: string }[] }>(
      "/expenses?limit=4&page=1&sortBy=date&sortDir=desc"
    )
      .then((data) => {
        if (!active) return;
        setRecentExpenses(data.expenses || []);
      })
      .catch(() => {
        if (!active) return;
        setRecentExpenses([]);
      });
    return () => {
      active = false;
    };
  }, [workspace?.enabledModules]);

  useEffect(() => {
    if (!workspace?.enabledModules.includes("sales")) {
      setRecentSales([]);
      return;
    }
    let active = true;
    apiFetch<{ sales: { _id: string; customerName: string; total: number; issueDate: string }[] }>(
      "/api/sales?limit=4&page=1"
    )
      .then((data) => {
        if (!active) return;
        setRecentSales(data.sales || []);
      })
      .catch(() => {
        if (!active) return;
        setRecentSales([]);
      });
    return () => {
      active = false;
    };
  }, [workspace?.enabledModules]);

  useEffect(() => {
    if (!workspace?.inventoryEnabled) {
      setRecentMovements([]);
      return;
    }
    let active = true;
    apiFetch<{ movements: any[] }>("/api/stock/movements?limit=5&page=1")
      .then((data) => {
        if (!active) return;
        setRecentMovements((data.movements || []) as any);
      })
      .catch(() => {
        if (!active) return;
        setRecentMovements([]);
      });
    return () => {
      active = false;
    };
  }, [workspace?.inventoryEnabled]);

  useEffect(() => {
    if (!workspace?.enabledModules.includes("tax")) {
      setTaxDeadlines([]);
      return;
    }
    let active = true;
    apiFetch<{ deadlines: TaxDeadline[] }>("/api/tax/deadlines")
      .then((data) => {
        if (!active) return;
        setTaxDeadlines(data.deadlines || []);
      })
      .catch(() => {
        if (!active) return;
        setTaxDeadlines([]);
      });
    return () => {
      active = false;
    };
  }, [workspace?.enabledModules]);

  useEffect(() => {
    if (!workspace?.inventoryEnabled) {
      setInventorySummary(null);
      return;
    }
    let active = true;
    apiFetch<{ stock: { onHand?: number; avgCost?: number; lowStock?: boolean }[] }>("/api/stock")
      .then((data) => {
        if (!active) return;
        const rows = data.stock || [];
        const lowStockCount = rows.reduce((sum, row) => sum + (row.lowStock ? 1 : 0), 0);
        const stockValue = rows.reduce(
          (sum, row) => sum + Number(row.onHand || 0) * Number(row.avgCost || 0),
          0
        );
        setInventorySummary({ lowStockCount, stockValue });
      })
      .catch(() => {
        if (!active) return;
        setInventorySummary(null);
      });
    return () => {
      active = false;
    };
  }, [workspace?.inventoryEnabled]);

  useEffect(() => {
    if (!workspace) return;
    if (period === "custom") return;
    const now = new Date();
    if (period === "all") {
      setFromDate("");
      setToDate("");
      loadDashboard("", "");
      return;
    }

    const to = toISODateLocal(now);
    let from = "";
    if (period === "today") {
      from = to;
    } else if (period === "week") {
      from = toISODateLocal(startOfWeekMonday(now));
    } else {
      from = toISODateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
    }
    setFromDate(from);
    setToDate(to);
    loadDashboard(from, to);
  }, [period, workspace]);

  const handlePtrTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    if (typeof window !== "undefined" && window.scrollY > 0) return;
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("input, textarea, select, [contenteditable='true'], [data-no-swipe='true']")) return;
    const t = e.touches[0];
    pullStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    pullingRef.current = false;
    setPtrDragging(false);
  };

  const handlePtrTouchMove = (e: React.TouchEvent) => {
    if (refreshing) return;
    const start = pullStartRef.current;
    if (!start) return;
    if (typeof window !== "undefined" && window.scrollY > 0) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dy <= 0) return;
    if (Math.abs(dx) > 40) return;
    pullingRef.current = true;
    setPtrDragging(true);
    setPullY(Math.min(96, dy * 0.55));
    e.preventDefault();
  };

  const handlePtrTouchEnd = async () => {
    const didPull = pullingRef.current;
    pullingRef.current = false;
    pullStartRef.current = null;
    setPtrDragging(false);
    if (!didPull) return;
    const threshold = 60;
    if (pullY < threshold) {
      setPullY(0);
      return;
    }
    setRefreshing(true);
    setPullY(threshold);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
      setPullY(0);
    }
  };

  const handleApply = () => {
    loadDashboard(fromDate, toDate);
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setPeriod("all");
    loadDashboard("", "");
  };

  const balanceValue =
    workspace?.businessType === "retail" && retailSummary
      ? retailSummary.sales_today - retailSummary.expenses_today
      : summary
      ? summary.invoices_paid_total - summary.expenses_total
      : 0;

  const snapshotTitle = useMemo(() => {
    if (period === "all") return "All time";
    if (period === "today") return "Today";
    if (period === "week") return "This week";
    if (period === "month") return "This month";
    return "Custom";
  }, [period]);

  const cashIn = useMemo(() => {
    if (!summary) return 0;
    if (workspace?.businessType === "retail" && period === "today" && retailSummary) return retailSummary.sales_today;
    return summary.invoices_paid_total;
  }, [period, retailSummary, summary, workspace?.businessType]);

  const cashOut = useMemo(() => {
    if (!summary) return 0;
    if (workspace?.businessType === "retail" && period === "today" && retailSummary) return retailSummary.expenses_today;
    return summary.expenses_total;
  }, [period, retailSummary, summary, workspace?.businessType]);

  const netProfit = useMemo(() => {
    if (workspace?.businessType === "retail" && period === "today" && retailSummary) return retailSummary.profit_today;
    return cashIn - cashOut;
  }, [cashIn, cashOut, period, retailSummary, workspace?.businessType]);

  const activity = useMemo(() => {
    const items: ActivityItem[] = [];
    for (const inv of recentInvoices) {
      items.push({
        key: `inv:${inv._id}`,
        kind: "invoice",
        title: inv.customerName,
        subtitle: workspace?.labels?.invoiceSingular || "Invoice",
        amount: inv.total,
        occurredAt: new Date(inv.issueDate),
        href: `/invoices/${inv._id}/receipt`
      });
    }
    for (const exp of recentExpenses) {
      items.push({
        key: `exp:${exp._id}`,
        kind: "expense",
        title: exp.title,
        subtitle: "Expense",
        amount: exp.amount,
        occurredAt: new Date(exp.date),
        href: `/expenses/${exp._id}/edit`
      });
    }
    for (const sale of recentSales) {
      items.push({
        key: `sale:${sale._id}`,
        kind: "sale",
        title: sale.customerName || "Sale",
        subtitle: "Sale",
        amount: sale.total,
        occurredAt: new Date(sale.issueDate),
        href: `/sales/${sale._id}/edit`
      });
    }
    for (const move of recentMovements) {
      const product = move.productId?.name || move.productId?.sku || "Stock movement";
      items.push({
        key: `stock:${move._id}`,
        kind: "stock",
        title: product,
        subtitle: move.type || "Stock",
        occurredAt: new Date(move.createdAt),
        href: "/inventory/stock"
      });
    }
    return items
      .filter((row) => Number.isFinite(row.occurredAt.getTime()))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 8);
  }, [recentExpenses, recentInvoices, recentMovements, recentSales, workspace?.labels?.invoiceSingular]);

  const quickActions = useMemo(() => {
    if (!workspace) return [];
    const actions: { label: string; href: string }[] = [];
    if (workspace.enabledModules.includes("sales")) actions.push({ label: "New sale", href: "/sales/new" });
    if (workspace.enabledModules.includes("invoices"))
      actions.push({ label: `New ${workspace.labels?.invoiceSingular || "invoice"}`, href: "/invoices/new" });
    if (workspace.enabledModules.includes("quotes")) actions.push({ label: "New quote", href: "/quotes/new" });
    if (workspace.enabledModules.includes("expenses")) actions.push({ label: "New expense", href: "/expenses/new" });
    if (workspace.inventoryEnabled) actions.push({ label: "Scan inventory", href: "/inventory/scan" });
    if (workspace.inventoryEnabled) actions.push({ label: "Add product", href: "/inventory/new" });
    actions.push({ label: "View reports", href: "/reports" });
    return actions.slice(0, 7);
  }, [workspace]);

  const accountingNeedsSetup =
    Boolean(company?.accountingEnabled) &&
    (!company?.accountingDefaults || Object.keys(company.accountingDefaults || {}).length === 0);

  return (
    <>
      <section
        className={`mobile-dashboard${ptrDragging || refreshing ? " ptr-active" : ""}`}
        onTouchStart={handlePtrTouchStart}
        onTouchMove={handlePtrTouchMove}
        onTouchEnd={handlePtrTouchEnd}
        style={{
          transform: pullY ? `translateY(${pullY}px)` : undefined,
          transition: ptrDragging ? "none" : pullY ? "none" : "transform 180ms ease-out"
        }}
      >
        <div className="ptr-indicator" aria-hidden="true">
          <div className="ptr-pill">
            <span className={`ptr-dot${refreshing ? " spinning" : ""}`} />
            <span>{refreshing ? "Refreshing…" : pullY >= 60 ? "Release to refresh" : "Pull to refresh"}</span>
          </div>
        </div>
        <div className="mobile-header">
          <button className="icon-button" type="button" onClick={() => startViewTransition(() => router.push("/settings"))}>
            ⚙
          </button>
          <div>
            <div className="muted">Welcome back</div>
            <div className="mobile-title">{workspace?.labels?.dashboard || "Dashboard"}</div>
          </div>
          <button className="icon-button" type="button" onClick={() => startViewTransition(() => router.push("/reports"))}>
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
            <button className="mobile-action" type="button" onClick={() => startViewTransition(() => router.push("/invoices/new"))}>
              {workspace?.labels?.invoiceSingular || "Invoice"}
            </button>
          ) : null}
          {workspace?.enabledModules.includes("expenses") ? (
            <button className="mobile-action" type="button" onClick={() => startViewTransition(() => router.push("/expenses/new"))}>
              Expense
            </button>
          ) : null}
          {workspace?.inventoryEnabled ? (
            <button className="mobile-action" type="button" onClick={() => startViewTransition(() => router.push("/inventory"))}>
              Inventory
            </button>
          ) : null}
          <button className="mobile-action" type="button" onClick={() => startViewTransition(() => router.push("/reports"))}>
            Reports
          </button>
        </div>

        <div className="mobile-section">
          <div className="mobile-section-header">
            <div>Recent activity</div>
            <button className="link-button" type="button" onClick={() => startViewTransition(() => router.push("/invoices"))}>
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
        <section className="panel dashboard-panel">
          <div className="dashboard-toolbar">
            <div className="panel-title">{workspace?.labels?.dashboard || "Dashboard"}</div>
            <div className="dashboard-toolbar-actions">
              <label className="field dashboard-field">
                Period
                <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)}>
                  <option value="month">This month</option>
                  <option value="week">This week</option>
                  <option value="today">Today</option>
                  <option value="all">All time</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <button className="button secondary" type="button" onClick={() => router.push("/reports")}>
                Reports
              </button>
            </div>
          </div>

          {period === "custom" ? (
            <>
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
              <div className="dashboard-range-actions">
                <button className="button secondary" type="button" onClick={handleApply}>
                  Apply
                </button>
                <button className="button secondary" type="button" onClick={handleClear}>
                  Clear
                </button>
                {error ? <div className="muted">{error}</div> : null}
              </div>
            </>
          ) : error ? (
            <div className="muted">{error}</div>
          ) : null}

          {loading || !summary ? (
            <div className="muted">Loading dashboard...</div>
          ) : (
            <div className="dashboard-cards">
              <div className="stat-card dashboard-card">
                <div className="muted">{snapshotTitle} snapshot</div>
                <div className="stat-value">{formatMoney(netProfit)}</div>
                <div className="muted">
                  Cash in: {formatMoney(cashIn)} · Cash out: {formatMoney(cashOut)}
                </div>
              </div>

              <div className="stat-card dashboard-card">
                <div className="muted">Outstanding</div>
                <div className="stat-value">
                  {workspace?.enabledModules.includes("invoices") ? formatMoney(summary.invoices_outstanding) : "—"}
                </div>
                <div className="muted">
                  Overdue: {workspace?.enabledModules.includes("invoices") ? summary.overdue_count : 0}
                </div>
                {workspace?.enabledModules.includes("invoices") ? (
                  <button className="button secondary" type="button" onClick={() => router.push("/invoices")}>
                    View {workspace?.labels?.invoices || "Invoices"}
                  </button>
                ) : null}
              </div>

              <div className="stat-card dashboard-card">
                <div className="muted">Alerts</div>
                <div className="stat-value">
                  {workspace?.inventoryEnabled
                    ? retailSummary?.low_stock_count ?? inventorySummary?.lowStockCount ?? 0
                    : 0}
                </div>
                <div className="muted">Low stock items</div>
                <div className="dashboard-alerts">
                  {workspace?.inventoryEnabled ? (
                    <button className="button secondary" type="button" onClick={() => router.push("/inventory/stock")}>
                      Stock by branch
                    </button>
                  ) : null}
                  {accountingNeedsSetup ? (
                    <button className="button secondary" type="button" onClick={() => router.push("/settings")}>
                      Configure accounting
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="panel dashboard-panel">
          <div className="panel-title">Quick actions</div>
          <div className="dashboard-actions">
            {quickActions.map((action) => (
              <button key={action.href} className="button secondary" type="button" onClick={() => router.push(action.href)}>
                {action.label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel dashboard-panel">
          <div className="dashboard-activity-header">
            <div className="panel-title">Recent activity</div>
            <button className="button secondary" type="button" onClick={() => router.push("/reports")}>
              See more
            </button>
          </div>
          <div className="dashboard-activity-list">
            {activity.length ? (
              activity.map((item) => (
                <button
                  key={item.key}
                  className="dashboard-activity-item"
                  type="button"
                  onClick={() => router.push(item.href)}
                >
                  <span className="badge">{item.kind}</span>
                  <span className="dashboard-activity-main">
                    <span className="dashboard-activity-title">{item.title}</span>
                    <span className="muted dashboard-activity-sub">{item.subtitle}</span>
                  </span>
                  <span className="dashboard-activity-meta">
                    <span className="muted">{item.occurredAt.toLocaleDateString()}</span>
                    {item.amount !== undefined ? <span className="dashboard-activity-amount">{formatMoney(item.amount)}</span> : null}
                  </span>
                </button>
              ))
            ) : (
              <div className="muted">No recent activity.</div>
            )}
          </div>
        </section>

        {workspace?.enabledModules.includes("tax") ? (
          <section className="panel dashboard-panel">
            <div className="dashboard-activity-header">
              <div className="panel-title">Tax deadlines</div>
              <button className="button secondary" type="button" onClick={() => router.push("/tax")}>
                Open tax
              </button>
            </div>
            <div className="dashboard-activity-list">
              {taxDeadlines.length ? (
                taxDeadlines
                  .slice(0, 6)
                  .map((d) => (
                    <div key={d._id} className="dashboard-activity-item" style={{ cursor: "default" }}>
                      <span className="badge">{d.taxType}</span>
                      <span className="dashboard-activity-main">
                        <span className="dashboard-activity-title">{d.title}</span>
                        <span className="muted dashboard-activity-sub">
                          Due {d.dueDate ? new Date(d.dueDate).toLocaleDateString() : "—"}
                        </span>
                      </span>
                      <span className="dashboard-activity-meta">
                        <span className="muted">{d.status || "pending"}</span>
                      </span>
                    </div>
                  ))
              ) : (
                <div className="muted">No upcoming deadlines yet. Open Tax to generate them.</div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
