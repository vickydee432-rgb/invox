"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import MobileHeader from "@/components/MobileHeader";
import Topbar from "@/components/Topbar";
import SyncBootstrap from "@/components/SyncBootstrap";
import NotificationPopups from "@/components/NotificationPopups";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { startViewTransition } from "@/lib/viewTransition";
import { DEFAULT_MOBILE_TABS, activeTabIndexIn, isTabRootPathIn } from "@/lib/mobileTabs";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [readOnly, setReadOnly] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

  const swipeTabs = useMemo(() => {
    const ws = workspace;
    if (!ws) return Array.from(DEFAULT_MOBILE_TABS);
    const tabs: string[] = ["/dashboard"];
    if (ws.enabledModules.includes("sales") && ws.enabledModules.includes("invoices")) tabs.push("/sales");
    if (ws.inventoryEnabled) tabs.push("/inventory");
    if (ws.enabledModules.includes("reports")) tabs.push("/reports");
    return tabs;
  }, [workspace]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    apiFetch<{ readOnly: boolean }>("/api/billing/status")
      .then((data) => {
        if (active) setReadOnly(Boolean(data.readOnly));
      })
      .catch(() => {
        if (active) setReadOnly(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<{ company: { workspaceConfigured?: boolean } }>("/api/company/me")
      .then((data) => {
        if (!active) return;
        setWorkspace(buildWorkspace(data.company as any));
        if (!data.company?.workspaceConfigured && pathname !== "/onboarding") {
          router.replace("/onboarding");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname, router]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("input, textarea, select, [contenteditable='true'], [data-no-swipe='true']")) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const touchStart = touchStartRef.current;
    if (!touchStart) return;
    const changed = e.changedTouches[0];
    if (!changed) return;
    const dx = changed.clientX - touchStart.x;
    const dy = changed.clientY - touchStart.y;
    const dt = Date.now() - touchStart.t;
    touchStartRef.current = null;

    if (dt > 700) return;
    if (Math.abs(dy) > 60) return;
    if (Math.abs(dx) < 70) return;

    const isDetail = !isTabRootPathIn(swipeTabs, pathname) && pathname !== "/onboarding";

    const edgeBack = touchStart.x <= 28 && dx > 90 && isDetail;
    if (edgeBack) {
      if (typeof window !== "undefined" && window.history.length > 1) {
        startViewTransition(() => router.back());
      } else {
        startViewTransition(() => router.push("/dashboard"));
      }
      return;
    }

    const onTabRoot = isTabRootPathIn(swipeTabs, pathname);
    if (!onTabRoot) return;

    const idx = activeTabIndexIn(swipeTabs, pathname);
    if (idx === -1) return;

    if (dx < 0 && idx < swipeTabs.length - 1) {
      startViewTransition(() => router.push(swipeTabs[idx + 1]));
      return;
    }

    if (dx > 0 && idx > 0) {
      startViewTransition(() => router.push(swipeTabs[idx - 1]));
    }
  };

  return (
    <div className={`app-shell${readOnly ? " read-only" : ""}`}>
      <Sidebar />
      <main className="content">
        <MobileHeader />
        <Topbar />
        <SyncBootstrap />
        <NotificationPopups />
        <div key={pathname} className="app-page" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {children}
        </div>
        <footer className="app-footer">
          <span className="muted">© {new Date().getFullYear()} Invox</span>
          <div className="footer-links">
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/cookies">Cookies</a>
            <a href="/acceptable-use">Acceptable Use</a>
            <a href="/billing-refund">Billing &amp; Refunds</a>
          </div>
        </footer>
      </main>
      <MobileNav />
    </div>
  );
}
