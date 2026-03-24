"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import SyncStatus from "@/components/SyncStatus";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type SearchItem = {
  key: string;
  title: string;
  subtitle: string;
  href: string;
};

type SearchGroup = {
  label: string;
  items: SearchItem[];
};

export default function Topbar() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

  const searchRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [billingStatus, setBillingStatus] = useState<{
    status: string;
    plan: string | null;
    billingCycle: string | null;
    dodoSubscriptionId?: string | null;
    cancelAtNextBillingDate?: boolean;
    seatLimit?: number | null;
    seatsUsed?: number;
    isActive: boolean;
    trialValid?: boolean;
    periodValid?: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: { name: string; email: string } }>("/api/auth/me")
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    apiFetch<{
      status: string;
      plan: string | null;
      billingCycle: string | null;
      dodoSubscriptionId?: string | null;
      cancelAtNextBillingDate?: boolean;
      seatLimit?: number | null;
      seatsUsed?: number;
      isActive: boolean;
      trialValid?: boolean;
      periodValid?: boolean;
      readOnly: boolean;
      isTrial?: boolean;
      trialEndsAt?: string;
    }>("/api/billing/status")
      .then((data) => {
        if (!active) return;
        setReadOnly(!data.isActive);
        setIsTrial(Boolean(data.trialValid));
        setTrialEndsAt(data.trialEndsAt || null);
        setBillingStatus(data);
      })
      .catch(() => {
        if (!active) return;
        setReadOnly(false);
        setIsTrial(false);
        setTrialEndsAt(null);
        setBillingStatus(null);
      });
    return () => {
      active = false;
    };
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
    const handler = (event: MouseEvent) => {
      if (!searchRef.current) return;
      if (event.target instanceof Node && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
      if (!userMenuRef.current) return;
      if (event.target instanceof Node && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setGroups([]);
      setSearchLoading(false);
      return;
    }

    let active = true;
    setSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const tasks: Array<Promise<SearchGroup | null>> = [];

        if (workspace?.inventoryEnabled) {
          tasks.push(
            apiFetch<{ products: { _id: string; name: string; sku?: string }[] }>(`/api/products?q=${encodeURIComponent(term)}`)
              .then((data) => {
                const items = (data.products || []).slice(0, 5).map((p) => ({
                  key: `product:${p._id}`,
                  title: p.name,
                  subtitle: p.sku ? `SKU ${p.sku}` : "Product",
                  href: "/inventory"
                }));
                return items.length ? { label: "Products", items } : null;
              })
              .catch(() => null)
          );
        }

        if (workspace?.enabledModules.includes("invoices")) {
          tasks.push(
            apiFetch<{ invoices: { _id: string; invoiceNo: string; customerName: string; total: number; issueDate: string }[] }>(
              `/api/invoices?limit=5&page=1&q=${encodeURIComponent(term)}`
            )
              .then((data) => {
                const items = (data.invoices || []).slice(0, 5).map((inv) => ({
                  key: `invoice:${inv._id}`,
                  title: `${inv.customerName} · ${inv.invoiceNo}`,
                  subtitle: new Date(inv.issueDate).toLocaleDateString(),
                  href: `/invoices/${inv._id}/receipt`
                }));
                return items.length ? { label: workspace?.labels?.invoices || "Invoices", items } : null;
              })
              .catch(() => null)
          );
        }

        if (workspace?.enabledModules.includes("expenses")) {
          tasks.push(
            apiFetch<{ expenses: { _id: string; title: string; amount: number; date: string }[] }>(
              `/expenses?limit=5&page=1&q=${encodeURIComponent(term)}&sortBy=date&sortDir=desc`
            )
              .then((data) => {
                const items = (data.expenses || []).slice(0, 5).map((exp) => ({
                  key: `expense:${exp._id}`,
                  title: exp.title,
                  subtitle: `${new Date(exp.date).toLocaleDateString()} · ${Number(exp.amount || 0).toFixed(2)}`,
                  href: `/expenses/${exp._id}/edit`
                }));
                return items.length ? { label: "Expenses", items } : null;
              })
              .catch(() => null)
          );
        }

        if (workspace?.enabledModules.includes("sales")) {
          tasks.push(
            apiFetch<{ sales: { _id: string; saleNo: string; customerName: string; total: number; issueDate: string }[] }>(
              `/api/sales?limit=5&page=1&q=${encodeURIComponent(term)}`
            )
              .then((data) => {
                const items = (data.sales || []).slice(0, 5).map((sale) => ({
                  key: `sale:${sale._id}`,
                  title: `${sale.customerName || "Sale"} · ${sale.saleNo}`,
                  subtitle: new Date(sale.issueDate).toLocaleDateString(),
                  href: `/sales/${sale._id}/edit`
                }));
                return items.length ? { label: "Sales", items } : null;
              })
              .catch(() => null)
          );
        }

        const resolved = await Promise.all(tasks);
        if (!active) return;
        setGroups(resolved.filter(Boolean) as SearchGroup[]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query, workspace]);

  const hasResults = useMemo(() => groups.some((g) => g.items.length), [groups]);

  const handleSelect = (href: string) => {
    setSearchOpen(false);
    setQuery("");
    router.push(href);
  };

  const handleCancelSubscription = async () => {
    setUserMenuOpen(false);
    const ok = window.confirm("Cancel your subscription at the end of the current billing period?");
    if (!ok) return;
    try {
      await apiFetch("/api/billing/cancel", { method: "POST", body: JSON.stringify({}) });
      // Refresh billing status
      const data = await apiFetch<{
        status: string;
        plan: string | null;
        billingCycle: string | null;
        dodoSubscriptionId?: string | null;
        cancelAtNextBillingDate?: boolean;
        seatLimit?: number | null;
        seatsUsed?: number;
        isActive: boolean;
        trialValid?: boolean;
        periodValid?: boolean;
        readOnly: boolean;
        isTrial?: boolean;
        trialEndsAt?: string;
      }>("/api/billing/status");
      setBillingStatus(data);
      setReadOnly(!data.isActive);
      setIsTrial(Boolean(data.trialValid));
      setTrialEndsAt(data.trialEndsAt || null);
    } catch (err: any) {
      alert(err.message || "Failed to cancel subscription");
    }
  };

  return (
    <div className="topbar">
      <div>
        <div className="panel-title">Cashflow Studio</div>
        <p className="muted">Quotes, invoices, and expenses in one clean ledger.</p>
        {readOnly ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <div className="badge">Read-only mode · Subscription required</div>
            <Link className="button secondary" href="/plans" data-allow="true">
              View plans
            </Link>
          </div>
        ) : isTrial ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <div className="badge">
              Trial ends {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : "soon"}
            </div>
            <Link className="button secondary" href="/plans" data-allow="true">
              Upgrade
            </Link>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="topbar-search" ref={searchRef}>
          <input
            className="topbar-search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search invoices, expenses, products..."
            type="search"
          />
          {searchOpen && (query.trim().length >= 2 || searchLoading) ? (
            <div className="topbar-search-menu">
              {searchLoading ? <div className="topbar-search-empty">Searching…</div> : null}
              {!searchLoading && !hasResults ? <div className="topbar-search-empty">No results.</div> : null}
              {groups.map((group) => (
                <div key={group.label} className="topbar-search-group">
                  <div className="topbar-search-group-title">{group.label}</div>
                  <div className="topbar-search-items">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        className="topbar-search-item"
                        type="button"
                        onClick={() => handleSelect(item.href)}
                      >
                        <div className="topbar-search-item-title">{item.title}</div>
                        <div className="topbar-search-item-sub">{item.subtitle}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <SyncStatus />
        <div className="topbar-user-menu" ref={userMenuRef}>
          <button
            className="badge topbar-user-trigger"
            type="button"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
          >
            {user ? `${user.name} · ${user.email}` : "Loading user..."}
          </button>
          {userMenuOpen ? (
            <div className="topbar-user-dropdown" role="menu">
              <Link href="/settings" onClick={() => setUserMenuOpen(false)}>
                Settings
              </Link>
              <Link href="/plans" onClick={() => setUserMenuOpen(false)}>
                Plans & Billing
              </Link>
              {billingStatus?.dodoSubscriptionId && !billingStatus?.cancelAtNextBillingDate ? (
                <button
                  className="topbar-user-dropdown-item"
                  type="button"
                  onClick={handleCancelSubscription}
                >
                  Cancel Subscription
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
