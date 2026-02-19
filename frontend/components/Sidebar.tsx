"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quotes", label: "Quotes" },
  { href: "/invoices", label: "Invoices" },
  { href: "/expenses", label: "Expenses" },
  { href: "/projects", label: "Projects" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" }
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [readOnly, setReadOnly] = useState(false);
  const [isTrial, setIsTrial] = useState(false);

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
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
            {item.label}
          </Link>
        ))}
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
