"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

  return (
    <div className={`app-shell${readOnly ? " read-only" : ""}`}>
      <Sidebar />
      <main className="content">
        <Topbar />
        {children}
      </main>
    </div>
  );
}
