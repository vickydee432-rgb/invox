"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

const BackIcon = () => (
  <svg {...iconProps}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const BellIcon = () => (
  <svg {...iconProps}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
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

  const baseTitle = useMemo(() => {
    const labels = workspace?.labels || {};
    if (pathname.startsWith("/quotes")) return labels.quotes || "Quotes";
    if (pathname.startsWith("/invoices")) return labels.invoices || "Invoices";
    if (pathname.startsWith("/expenses")) return labels.expenses || "Expenses";
    if (pathname.startsWith("/projects")) return labels.projects || "Projects";
    if (pathname.startsWith("/inventory")) return labels.inventory || "Inventory";
    if (pathname.startsWith("/reports")) return labels.reports || "Reports";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/plans")) return "Plans";
    return labels.dashboard || "Dashboard";
  }, [pathname, workspace]);

  const showBack = pathname !== "/dashboard" && pathname !== "/";
  const rightHref =
    workspace?.enabledModules?.includes("reports") && workspace?.enabledModules?.length
      ? "/reports"
      : "/settings";

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="mobile-header-bar">
      {showBack ? (
        <button className="icon-button" type="button" aria-label="Back" onClick={handleBack}>
          <BackIcon />
        </button>
      ) : (
        <div className="mobile-header-spacer" />
      )}
      <div className="mobile-header-title">{baseTitle}</div>
      <Link className="icon-button" aria-label="Notifications" href={rightHref}>
        <BellIcon />
      </Link>
    </div>
  );
}
