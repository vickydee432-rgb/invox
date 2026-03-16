"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type SessionUser = {
  _id: string;
  name: string;
  email: string;
  role?: string;
  permissions?: string[];
};

const MODULE_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  accounting: "/accounting",
  quotes: "/quotes",
  sales: "/sales",
  invoices: "/invoices",
  purchases: "/purchases",
  expenses: "/expenses",
  projects: "/projects",
  inventory: "/inventory",
  payroll: "/payroll",
  banking: "/banking",
  tax: "/tax",
  reports: "/reports",
  documents: "/documents",
  notifications: "/notifications",
  audit: "/audit",
  settings: "/settings"
};

const MODULE_ORDER = [
  "dashboard",
  "accounting",
  "quotes",
  "sales",
  "invoices",
  "purchases",
  "expenses",
  "inventory",
  "payroll",
  "banking",
  "tax",
  "reports",
  "documents",
  "notifications",
  "projects",
  "audit",
  "settings"
];

function hasPermission(permissions: string[] | undefined, permission: string) {
  const perms = Array.isArray(permissions) ? permissions : [];
  return perms.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern === permission) return true;
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const re = new RegExp(`^${escaped}$`);
    return re.test(permission);
  });
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [readOnly, setReadOnly] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const loadWorkspace = async () => {
    try {
      const data = await apiFetch<{ company: any }>("/api/company/me");
      setWorkspace(buildWorkspace(data.company));
    } catch (err) {
      // ignore workspace errors
    }
  };

  useEffect(() => {
    let active = true;
    apiFetch<{ user: SessionUser }>("/api/auth/me")
      .then((data) => {
        if (!active) return;
        setUser(data.user);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<{ readOnly: boolean; isTrial?: boolean }>("/api/billing/status")
      .then((data) => {
        if (!active) return;
        setReadOnly(Boolean(data.readOnly));
        setIsTrial(Boolean(data.isTrial));
      })
      .catch(() => {
        if (!active) return;
        setReadOnly(false);
        setIsTrial(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadWorkspace();
    const handler = () => loadWorkspace();
    window.addEventListener("workspace:updated", handler);
    return () => window.removeEventListener("workspace:updated", handler);
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const isActiveHref = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const buildNavModules = () => {
    const enabledModules = workspace?.enabledModules || [];
    const baseModules = new Set(["dashboard", ...enabledModules, "settings"]);
    if (hasPermission(user?.permissions, "audit:read")) baseModules.add("audit");
    const ordered = MODULE_ORDER.filter((module) => baseModules.has(module));
    const extras = Array.from(baseModules).filter((module) => !MODULE_ORDER.includes(module));
    const modules = [...ordered, ...extras];
    const filtered = modules.filter((module) => {
      if (module === "sales" && !enabledModules.includes("invoices")) return false;
      if (module === "inventory") return workspace?.inventoryEnabled;
      if (module === "projects") return workspace?.projectTrackingEnabled;
      return true;
    });
    const unique = Array.from(new Set(filtered));
    return unique
      .filter((module) => MODULE_ROUTES[module])
      .filter((module) => {
        if (module === "settings") return hasPermission(user?.permissions, "settings:read");
        if (module === "audit") return hasPermission(user?.permissions, "audit:read");
        return hasPermission(user?.permissions, `module:${module}:read`) || hasPermission(user?.permissions, "module:*:read");
      });
  };

  const navModules = buildNavModules();
  const showPlans = readOnly || isTrial;

  const allNavItems = useMemo(() => {
    const items = navModules.map((module) => ({
      key: module,
      href: MODULE_ROUTES[module],
      label:
        module === "settings"
          ? "Settings"
          : module === "audit"
          ? "Audit"
          : workspace?.labels?.[module] || module
    }));
    if (showPlans) {
      items.push({ key: "plans", href: "/plans", label: "Plans" });
    }
    return items;
  }, [navModules, workspace, showPlans]);

  const { visibleItems, overflowItems } = useMemo(() => {
    const MAX_VISIBLE = 7;
    const pinnedStart = ["dashboard"];
    const pinnedEnd = showPlans ? ["plans", "settings"] : ["settings"];

    const startItems = allNavItems.filter((item) => pinnedStart.includes(item.key));
    const endItems = allNavItems.filter((item) => pinnedEnd.includes(item.key));
    const middleItems = allNavItems.filter(
      (item) => !pinnedStart.includes(item.key) && !pinnedEnd.includes(item.key)
    );

    const slots = Math.max(0, MAX_VISIBLE - startItems.length - endItems.length);
    const visibleMiddle = middleItems.slice(0, slots);
    const overflow = middleItems.slice(slots);

    const activeOverflowIndex = overflow.findIndex((item) => isActiveHref(item.href));
    if (activeOverflowIndex >= 0 && visibleMiddle.length > 0) {
      const swappedVisible = [...visibleMiddle];
      const swappedOverflow = [...overflow];
      const lastVisible = swappedVisible[swappedVisible.length - 1];
      swappedVisible[swappedVisible.length - 1] = swappedOverflow[activeOverflowIndex];
      swappedOverflow[activeOverflowIndex] = lastVisible;
      return {
        visibleItems: [...startItems, ...swappedVisible, ...endItems],
        overflowItems: swappedOverflow
      };
    }

    return {
      visibleItems: [...startItems, ...visibleMiddle, ...endItems],
      overflowItems: overflow
    };
  }, [allNavItems, pathname, showPlans]);

  const overflowHasActive = overflowItems.some((item) => isActiveHref(item.href));

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!moreRef.current) return;
      if (event.target instanceof Node && moreRef.current.contains(event.target)) return;
      setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    if (moreOpen) {
      window.addEventListener("mousedown", handler);
      window.addEventListener("keydown", onKey);
    }
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <header className="sidebar">
      <div>
        <div className="brand">Invox</div>
        <span className="brand-tag">Studio Ledger</span>
      </div>
      <nav className="nav">
        {visibleItems.map((item) => {
          return (
            <Link key={item.key} href={item.href} className={isActiveHref(item.href) ? "active" : ""}>
              {item.label}
            </Link>
          );
        })}
        {overflowItems.length > 0 ? (
          <div className="nav-more" ref={moreRef}>
            <button
              type="button"
              className={`nav-more-trigger${moreOpen || overflowHasActive ? " active" : ""}`}
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              More
            </button>
            {moreOpen ? (
              <div className="nav-more-menu" role="menu">
                {overflowItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={isActiveHref(item.href) ? "active" : ""}
                    onClick={() => setMoreOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>
      <div className="nav-actions">
        <button className="button ghost" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
