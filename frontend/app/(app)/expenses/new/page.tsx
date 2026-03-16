"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getDeviceId } from "@/lib/device";
import { enqueueChange } from "@/lib/sync";
import { getSyncContext } from "@/lib/syncContext";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

export default function NewExpensePage() {
  const router = useRouter();
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [pasteSuccess, setPasteSuccess] = useState("");
  const [pasteErrors, setPasteErrors] = useState<{ line: number; error: string; raw: string }[]>([]);
  const [pasteSkipped, setPasteSkipped] = useState<{ line: number; error: string; raw: string }[]>([]);
  const [pasting, setPasting] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [projectLabel, setProjectLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (!date) setDate(today);
  }, [date]);

  useEffect(() => {
    let active = true;
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => {
        if (!active) return;
        const config = buildWorkspace(data.company);
        setWorkspace(config);
        if (config.businessType === "retail" && !category) setCategory("stock purchase");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handlePasteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pasteText.trim()) return;
    setPasting(true);
    setPasteError("");
    setPasteSuccess("");
    setPasteErrors([]);
    setPasteSkipped([]);
    try {
      const data = await apiFetch<{
        createdCount: number;
        errors?: { line: number; error: string; raw: string }[];
        skipped?: { line: number; error: string; raw: string }[];
      }>("/expenses/bulk", {
        method: "POST",
        body: JSON.stringify({ text: pasteText })
      });
      setPasteText("");
      const skippedCount = data.skipped?.length ?? 0;
      setPasteSuccess(
        skippedCount > 0
          ? `Imported ${data.createdCount} expenses. Skipped ${skippedCount} duplicates.`
          : `Imported ${data.createdCount} expenses.`
      );
      setPasteErrors(data.errors || []);
      setPasteSkipped(data.skipped || []);
      try {
        const context = getSyncContext();
        if (context && typeof navigator !== "undefined" && navigator.onLine) {
          const deviceId = getDeviceId();
          const db = getDb(context.companyId, deviceId);
          const params = new URLSearchParams();
          params.set("page", "1");
          params.set("limit", "500");
          const seed = await apiFetch<{ expenses: any[] }>(`/expenses?${params.toString()}`);
          if (seed.expenses?.length) {
            const mapped = seed.expenses.map((expense) => ({
              id: expense._id,
              serverId: expense._id,
              companyId: context.companyId,
              workspaceId: context.workspaceId,
              userId: context.userId,
              deviceId,
              createdAt: expense.createdAt || new Date().toISOString(),
              updatedAt: expense.updatedAt || new Date().toISOString(),
              deletedAt: expense.deletedAt || null,
              version: expense.version || 1,
              title: expense.title,
              category: expense.category,
              amount: expense.amount,
              date: expense.date,
              projectId: expense.projectId || null,
              projectLabel: expense.projectLabel || undefined,
              supplier: expense.supplier,
              paidTo: expense.paidTo,
              paymentMethod: expense.paymentMethod,
              note: expense.note,
              receipts: expense.receipts || []
            }));
            await db.expenses.bulkPut(mapped);
          }
        }
      } catch (err) {
        // ignore seed errors
      }
    } catch (err: any) {
      setPasteError(err.message || "Failed to import expenses");
    } finally {
      setPasting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const context = getSyncContext();
      if (!context) {
        setError("Offline data not ready. Connect online once to initialize sync.");
        setSaving(false);
        return;
      }
      const deviceId = getDeviceId();
      const db = getDb(context.companyId, deviceId);
      const now = new Date().toISOString();
      const localExpense = {
        id: crypto.randomUUID(),
        serverId: null,
        companyId: context.companyId,
        workspaceId: context.workspaceId,
        userId: context.userId,
        deviceId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1,
        title,
        category,
        amount,
        date,
        projectLabel: projectLabel || undefined,
        receipts: receiptUrl ? [{ url: receiptUrl }] : []
      };
      await db.expenses.put(localExpense);
      await enqueueChange(context, {
        entityType: "expense",
        operation: "create",
        recordId: localExpense.id,
        serverId: null,
        payload: localExpense
      });
      router.push("/expenses");
    } catch (err: any) {
      setError(err.message || "Failed to create expense");
    } finally {
      setSaving(false);
    }
  };

  if (workspace && !workspace.enabledModules.includes("expenses")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.expenses || "Expenses"}</div>
        <div className="muted">Expenses are disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => router.push("/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="panel-title">Quick Paste</div>
          <button className="button secondary" type="button" onClick={() => setShowPaste((prev) => !prev)}>
            {showPaste ? "Hide" : "Show"}
          </button>
        </div>
        {showPaste ? (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              Paste one expense per line. Supported formats:
              <br />
              <strong>Title | Amount | Category | Date</strong> (recommended), or
              <br />
              <strong>Title Amount Category Date</strong>, or
              <br />
              a pasted table with header columns like <strong>Title</strong>, <strong>Category</strong>,
              <strong>Amount</strong>, <strong>Date</strong> (extra columns are ignored).
              <br />
              Date examples: 2025-02-14, 02/14/2025, 14/02/2025, Feb. 4, 2026
            </p>
            <form onSubmit={handlePasteSubmit} style={{ display: "grid", gap: 12 }}>
              <label className="field">
                Paste expenses
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={6}
                  placeholder="VARIOUS ITEMS | 5350 | TAX INVOICE | 2025-02-04"
                />
              </label>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button className="button" type="submit" disabled={pasting}>
                  {pasting ? "Importing..." : "Import expenses"}
                </button>
                {pasteSuccess ? <div className="muted">{pasteSuccess}</div> : null}
                {pasteError ? <div className="muted">{pasteError}</div> : null}
              </div>
            </form>
            {pasteErrors.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div className="muted">Some lines could not be imported:</div>
                <ul style={{ marginTop: 8, paddingLeft: 18, listStyle: "disc" }}>
                  {pasteErrors.map((err) => (
                    <li key={`${err.line}-${err.error}`} className="muted">
                      Line {err.line}: {err.error} — {err.raw}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {pasteSkipped.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div className="muted">Skipped duplicates:</div>
                <ul style={{ marginTop: 8, paddingLeft: 18, listStyle: "disc" }}>
                  {pasteSkipped.map((err, idx) => (
                    <li key={`${err.line}-${err.error}-${idx}`} className="muted">
                      Line {err.line}: {err.error} — {err.raw}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          {workspace?.businessType === "retail" ? "Quick Add Expense" : "Create Expense"}
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div className="grid-2">
            <label className="field">
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label className="field">
              Category
              {workspace?.businessType === "retail" ? (
                <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                  <option value="stock purchase">Stock purchase</option>
                  <option value="utilities">Utilities</option>
                  <option value="transport">Transport</option>
                  <option value="other">Other</option>
                </select>
              ) : (
                <input value={category} onChange={(e) => setCategory(e.target.value)} required />
              )}
            </label>
            <label className="field">
              Amount
              <input
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                type="number"
                min={0}
                required
              />
            </label>
            <label className="field">
              Date
              <input value={date} onChange={(e) => setDate(e.target.value)} type="date" required />
            </label>
            {workspace?.projectTrackingEnabled ? (
              <label className="field">
                Project label (optional)
                <input value={projectLabel} onChange={(e) => setProjectLabel(e.target.value)} />
              </label>
            ) : null}
            {workspace?.businessType === "retail" ? (
              <label className="field">
                Receipt image URL (optional)
                <input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} />
              </label>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create expense"}
            </button>
            <button className="button secondary" type="button" onClick={() => router.push("/expenses")}>
              Cancel
            </button>
          </div>
          {error ? <div className="muted">{error}</div> : null}
        </form>
      </section>
    </>
  );
}
