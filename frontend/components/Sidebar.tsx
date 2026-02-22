"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

const navItems = [
  { href: "/dashboard", labelKey: "dashboard", module: "dashboard" },
  { href: "/quotes", labelKey: "quotes", module: "quotes" },
  { href: "/invoices", labelKey: "invoices", module: "invoices" },
  { href: "/expenses", labelKey: "expenses", module: "expenses" },
  { href: "/projects", labelKey: "projects", module: "projects" },
  { href: "/inventory", labelKey: "inventory", module: "inventory" },
  { href: "/reports", labelKey: "reports", module: "reports" },
  { href: "/settings", labelKey: "settings", module: "settings" }
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [readOnly, setReadOnly] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

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

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  return (
    <header className="sidebar">
      <div>
        <div className="brand">Invox</div>
        <span className="brand-tag">Studio Ledger</span>
      </div>
      <nav className="nav">
        {navItems
          .filter((item) => {
            if (item.module === "dashboard" || item.module === "settings") return true;
            if (!workspace) return true;
            if (item.module === "inventory") return workspace.inventoryEnabled;
            if (item.module === "projects") return workspace.projectTrackingEnabled;
            return workspace.enabledModules.includes(item.module);
          })
          .map((item) => {
            const label =
              item.labelKey === "settings"
                ? "Settings"
                : workspace?.labels?.[item.labelKey] || item.labelKey;
            return (
              <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
                {label}
              </Link>
            );
          })}
        {readOnly || isTrial ? (
          <Link href="/plans" className={pathname === "/plans" ? "active" : ""}>
            Plans
          </Link>
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
