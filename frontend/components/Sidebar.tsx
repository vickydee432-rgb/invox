"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

const MODULE_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  quotes: "/quotes",
  invoices: "/invoices",
  expenses: "/expenses",
  projects: "/projects",
  inventory: "/inventory",
  reports: "/reports",
  settings: "/settings"
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [readOnly, setReadOnly] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

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

  const buildNavModules = () => {
    const enabledModules = workspace?.enabledModules || [];
    const modules = ["dashboard", ...enabledModules, "settings"];
    const filtered = modules.filter((module) => {
      if (module === "inventory") return workspace?.inventoryEnabled;
      if (module === "projects") return workspace?.projectTrackingEnabled;
      return true;
    });
    const unique = Array.from(new Set(filtered));
    return unique.filter((module) => MODULE_ROUTES[module]);
  };

  const navModules = buildNavModules();

  return (
    <header className="sidebar">
      <div>
        <div className="brand">Invox</div>
        <span className="brand-tag">Studio Ledger</span>
      </div>
      <nav className="nav">
        {navModules.map((module) => {
          const href = MODULE_ROUTES[module];
          const label =
            module === "settings" ? "Settings" : workspace?.labels?.[module] || module;
          return (
            <Link key={module} href={href} className={pathname === href ? "active" : ""}>
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
