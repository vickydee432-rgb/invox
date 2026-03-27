"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import MobileHeader from "@/components/MobileHeader";
import Topbar from "@/components/Topbar";
import SyncBootstrap from "@/components/SyncBootstrap";
import NotificationPopups from "@/components/NotificationPopups";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [readOnly, setReadOnly] = useState(false);

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
        if (!data.company?.workspaceConfigured && pathname !== "/onboarding") {
          router.replace("/onboarding");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname, router]);

  return (
    <div className={`app-shell${readOnly ? " read-only" : ""}`}>
      <Sidebar />
      <main className="content">
        <MobileHeader />
        <Topbar />
        <SyncBootstrap />
        <NotificationPopups />
        {children}
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
