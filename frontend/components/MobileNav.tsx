"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

const ICONS: Record<string, JSX.Element> = {
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
  )
};

export default function MobileNav() {
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

  useEffect(() => {
    let active = true;
    const loadWorkspace = () => {
      apiFetch<{ company: any }>("/api/company/me")
        .then((data) => {
          if (!active) return;
          setWorkspace(buildWorkspace(data.company));
        })
        .catch(() => {});
    };
    loadWorkspace();
    const handler = () => loadWorkspace();
    window.addEventListener("workspace:updated", handler);
    return () => {
      active = false;
      window.removeEventListener("workspace:updated", handler);
    };
  }, []);

  const enabledModules = workspace?.enabledModules || [];
  const modules = ["dashboard", ...enabledModules, "settings"].filter((module) => {
    if (module === "inventory") return workspace?.inventoryEnabled;
    if (module === "projects") return workspace?.projectTrackingEnabled;
    return true;
  });

  const uniqueModules = Array.from(new Set(modules)).filter((module) => MODULE_ROUTES[module]);

  const compactModules = uniqueModules.filter((module) =>
    ["dashboard", "invoices", "expenses", "reports", "settings"].includes(module)
  );

  const navModules = compactModules.length >= 4 ? compactModules.slice(0, 4) : uniqueModules.slice(0, 4);

  const normalizeLabel = (value: string) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  return (
    <nav className="mobile-nav">
      {navModules.map((module) => {
        const href = MODULE_ROUTES[module];
        const baseLabel = workspace?.labels?.[module] || module;
        const label = module === "settings" ? "Settings" : normalizeLabel(baseLabel);
        const icon = ICONS[module] || ICONS.dashboard;
        return (
          <Link key={module} href={href} className={pathname === href ? "active" : ""}>
            <span className="mobile-nav-icon">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
