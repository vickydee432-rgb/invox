"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

const MODULE_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  quotes: "/quotes",
  sales: "/sales",
  invoices: "/invoices",
  expenses: "/expenses",
  projects: "/projects",
  inventory: "/inventory",
  reports: "/reports",
  settings: "/settings"
};

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round"
} as const;

const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg {...iconProps}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </svg>
  ),
  invoices: (
    <svg {...iconProps}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  ),
  sales: (
    <svg {...iconProps}>
      <path d="M4 4h16v6H4z" />
      <path d="M7 14h10" />
      <path d="M9 18h6" />
    </svg>
  ),
  quotes: (
    <svg {...iconProps}>
      <path d="M20 12v7a2 2 0 0 1-2 2H6l-2-2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
      <path d="M16 8l6 4-6 4" />
    </svg>
  ),
  expenses: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M8 13l4 4 4-4" />
    </svg>
  ),
  projects: (
    <svg {...iconProps}>
      <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H3z" />
      <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  inventory: (
    <svg {...iconProps}>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <path d="M3 7l9 4 9-4" />
      <path d="M12 11v10" />
    </svg>
  ),
  reports: (
    <svg {...iconProps}>
      <path d="M4 19V5" />
      <path d="M10 19V9" />
      <path d="M16 19v-6" />
      <path d="M22 19V7" />
    </svg>
  ),
  settings: (
    <svg {...iconProps}>
      <path d="M4 7h8" />
      <path d="M14 7h6" />
      <path d="M4 17h6" />
      <path d="M12 17h8" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  ),
  plans: (
    <svg {...iconProps}>
      <path d="M4 20h16" />
      <path d="M6 16l4-8 4 5 4-9" />
    </svg>
  ),
  logout: (
    <svg {...iconProps}>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 3v18" />
    </svg>
  )
};

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [showPlans, setShowPlans] = useState(false);

  useEffect(() => {
    let active = true;
    const loadWorkspace = async () => {
      const [companyData, billingData] = await Promise.allSettled([
        apiFetch<{ company: any }>("/api/company/me"),
        apiFetch<{ readOnly: boolean; isTrial?: boolean }>("/api/billing/status")
      ]);
      if (!active) return;

      if (companyData.status === "fulfilled") {
        setWorkspace(buildWorkspace(companyData.value.company));
      }

      if (billingData.status === "fulfilled") {
        setShowPlans(Boolean(billingData.value.readOnly || billingData.value.isTrial));
      }
    };
    loadWorkspace().catch(() => {});
    const handler = () => {
      apiFetch<{ company: any }>("/api/company/me")
        .then((data) => {
          if (!active) return;
          setWorkspace(buildWorkspace(data.company));
        })
        .catch(() => {});
    };
    window.addEventListener("workspace:updated", handler);
    return () => {
      active = false;
      window.removeEventListener("workspace:updated", handler);
    };
  }, []);

  const enabledModules = workspace?.enabledModules || [];
  const modules = ["dashboard", ...enabledModules, "settings"].filter((module) => {
    if (module === "sales" && !enabledModules.includes("invoices")) return false;
    if (module === "inventory") return workspace?.inventoryEnabled;
    if (module === "projects") return workspace?.projectTrackingEnabled;
    return true;
  });

  const uniqueModules = Array.from(new Set(modules)).filter((module) => MODULE_ROUTES[module]);

  const normalizeLabel = (value: string) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const navModules = uniqueModules;

  return (
    <nav className="mobile-nav">
      {navModules.map((module) => {
        const href = MODULE_ROUTES[module];
        const baseLabel = workspace?.labels?.[module] || module;
        const label = module === "settings" ? "Settings" : normalizeLabel(baseLabel);
        const icon = ICONS[module] || ICONS.dashboard;
        return (
          <Link key={module} href={href} className={isActive(href) ? "active" : ""}>
            <span className="mobile-nav-icon">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
      {showPlans ? (
        <Link href="/plans" className={isActive("/plans") ? "active" : ""}>
          <span className="mobile-nav-icon">{ICONS.plans}</span>
          <span>Plans</span>
        </Link>
      ) : null}
      <button type="button" onClick={handleLogout}>
        <span className="mobile-nav-icon">{ICONS.logout}</span>
        <span>Logout</span>
      </button>
    </nav>
  );
}
