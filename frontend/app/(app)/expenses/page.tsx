"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BaseRecord, getDb } from "@/lib/db";
import { getDeviceId } from "@/lib/device";
import { enqueueChange } from "@/lib/sync";
import { getSyncContext } from "@/lib/syncContext";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Expense = {
  id: string;
  serverId?: string | null;
  title: string;
  category: string;
  amount: number;
  date: string;
  projectId?: string | null;
  projectLabel?: string;
  deletedAt?: string | null;
  version?: number;
};

type ExpenseRecord = Expense & BaseRecord;

type Project = {
  _id: string;
  name: string;
};

const LIMIT = 12;

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [seeded, setSeeded] = useState(false);

  const mapServerExpense = (expense: any, context: { companyId: string; workspaceId: string; userId: string }) => {
    const deviceId = getDeviceId();
    return {
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
    };
  };

  const loadExpenses = async (
    targetPage = page,
    keyword = query,
    categoryValue = categoryFilter,
    projectValue = filterProjectId,
    fromValue = fromDate,
    toValue = toDate,
    sortField = sortBy,
    sortDirection = sortDir
  ) => {
    setLoading(true);
    setError("");
    try {
      const context = getSyncContext();
      if (!context) {
        setError("Offline data not ready. Connect online once to initialize sync.");
        setLoading(false);
        return;
      }
      const db = getDb(context.companyId, getDeviceId());
      const queryLocal = async (): Promise<ExpenseRecord[]> => {
        let items = (await db.expenses
          .where("companyId")
          .equals(context.companyId)
          .and((exp: any) => exp.workspaceId === context.workspaceId && !exp.deletedAt)
          .toArray()) as ExpenseRecord[];
        if (keyword) {
          const lower = keyword.toLowerCase();
          items = items.filter((exp: any) => String(exp.title || "").toLowerCase().includes(lower));
        }
        if (categoryValue) {
          items = items.filter((exp: any) => String(exp.category || "") === categoryValue);
        }
        if (projectValue) {
          items = items.filter((exp: any) => String(exp.projectId || "") === projectValue);
        }
        if (fromValue) {
          const fromTs = new Date(fromValue).getTime();
          items = items.filter((exp: any) => new Date(exp.date).getTime() >= fromTs);
        }
        if (toValue) {
          const toTs = new Date(toValue).getTime();
          items = items.filter((exp: any) => new Date(exp.date).getTime() <= toTs);
        }
        const dir = sortDirection === "asc" ? 1 : -1;
        items.sort((a: any, b: any) => {
          if (sortField === "amount") return (a.amount - b.amount) * dir;
          if (sortField === "title") return String(a.title || "").localeCompare(String(b.title || "")) * dir;
          if (sortField === "category") return String(a.category || "").localeCompare(String(b.category || "")) * dir;
          const aDate = new Date(a.date).getTime();
          const bDate = new Date(b.date).getTime();
          return (aDate - bDate) * dir;
        });
        return items;
      };

      let items = await queryLocal();
      if (items.length === 0 && typeof navigator !== "undefined" && navigator.onLine && !seeded) {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "500");
        if (keyword) params.set("q", keyword);
        if (categoryValue) params.set("category", categoryValue);
        if (projectValue) params.set("projectId", projectValue);
        if (fromValue) params.set("from", fromValue);
        if (toValue) params.set("to", toValue);
        const data = await apiFetch<{ expenses: any[] }>(`/api/expenses?${params.toString()}`);
        if (data.expenses?.length) {
          await db.expenses.bulkPut(data.expenses.map((exp) => mapServerExpense(exp, context)));
        }
        setSeeded(true);
        items = await queryLocal();
      }

      const total = items.length;
      const totalPages = Math.max(1, Math.ceil(total / LIMIT));
      const start = (targetPage - 1) * LIMIT;
      const paged = items.slice(start, start + LIMIT);
      setExpenses(paged);
      setPage(Math.min(targetPage, totalPages));
      setPages(totalPages);
      setSelectedIds([]);
    } catch (err: any) {
      setError(err.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    if (workspace && !workspace.enabledModules.includes("expenses")) {
      setLoading(false);
      return;
    }
    loadExpenses(page, query, categoryFilter, filterProjectId, fromDate, toDate, sortBy, sortDir);
  }, [page, query, categoryFilter, filterProjectId, fromDate, toDate, sortBy, sortDir, workspace]);

  useEffect(() => {
    if (workspace?.projectTrackingEnabled === false) {
      setProjects([]);
      return;
    }
    const loadProjects = async () => {
      try {
        const data = await apiFetch<{ projects: Project[] }>("/api/projects");
        setProjects(data.projects || []);
      } catch (err) {
        // ignore project list errors
      }
    };
    loadProjects();
  }, [workspace?.projectTrackingEnabled]);

  const allVisibleSelected = useMemo(() => {
    if (expenses.length === 0) return false;
    return expenses.every((exp) => selectedIds.includes(exp.id));
  }, [expenses, selectedIds]);

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !expenses.some((exp) => exp.id === id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      expenses.forEach((exp) => next.add(exp.id));
      return Array.from(next);
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((val) => val !== id) : [...prev, id]));
  };

  const handleSearch = () => {
    setPage(1);
    setQuery(search.trim());
    setCategoryFilter(category.trim());
  };

  const handleClear = () => {
    setSearch("");
    setQuery("");
    setCategory("");
    setCategoryFilter("");
    setFilterProjectId("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const handleAssign = async () => {
    setAssignError("");
    setAssignSuccess("");
    if (!projectId) {
      setAssignError("Select a project.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setAssignError("You're offline. Sync to assign expenses to projects.");
      return;
    }
    if (applyToAll) {
      if (!query && !categoryFilter && !filterProjectId && !fromDate && !toDate) {
        setAssignError("Set at least one filter first.");
        return;
      }
    } else if (selectedIds.length === 0) {
      setAssignError("Select at least one expense.");
      return;
    }

    setAssigning(true);
    try {
      if (!applyToAll) {
        const selectedExpenses = expenses.filter((exp) => selectedIds.includes(exp.id));
        const missingServerIds = selectedExpenses.filter((exp) => !exp.serverId);
        if (missingServerIds.length > 0) {
          setAssignError("Some selected expenses haven't synced yet.");
          setAssigning(false);
          return;
        }
      }
      const payload = applyToAll
        ? {
            projectId,
            filter: {
              q: query,
              category: categoryFilter || undefined,
              projectId: filterProjectId || undefined,
              from: fromDate || undefined,
              to: toDate || undefined
            }
          }
        : {
            projectId,
            expenseIds: expenses
              .filter((exp) => selectedIds.includes(exp.id))
              .map((exp) => exp.serverId as string)
          };
      const data = await apiFetch<{ updatedCount: number }>("/api/expenses/bulk/project", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setAssignSuccess(`Updated ${data.updatedCount} expenses.`);
      setSelectedIds([]);
      await loadExpenses(page, query);
    } catch (err: any) {
      setAssignError(err.message || "Failed to assign expenses");
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    const ok = window.confirm("Delete this expense? This cannot be undone.");
    if (!ok) return;
    try {
      const context = getSyncContext();
      if (!context) {
        setError("Offline data not ready. Connect online once to initialize sync.");
        return;
      }
      const db = getDb(context.companyId, getDeviceId());
      const existing = await db.expenses.get(expenseId);
      if (!existing) {
        if (typeof navigator !== "undefined" && navigator.onLine) {
          await apiFetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
        }
      } else {
        const now = new Date().toISOString();
        const next = {
          ...existing,
          deletedAt: now,
          updatedAt: now,
          version: (existing.version || 1) + 1
        };
        await db.expenses.put(next);
        await enqueueChange(context, {
          entityType: "expense",
          operation: "delete",
          recordId: expenseId,
          serverId: existing.serverId ?? null,
          payload: next
        });
      }
      await loadExpenses(page, query, categoryFilter, filterProjectId, fromDate, toDate);
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
    }
  };

  const handleDeleteAll = async () => {
    const ok = window.confirm("Delete all filtered expenses? This cannot be undone.");
    if (!ok) return;
    try {
      const context = getSyncContext();
      if (!context) {
        setError("Offline data not ready. Connect online once to initialize sync.");
        return;
      }
      const db = getDb(context.companyId, getDeviceId());
      let items = await db.expenses
        .where("companyId")
        .equals(context.companyId)
        .and((exp: any) => exp.workspaceId === context.workspaceId && !exp.deletedAt)
        .toArray();
      if (query) {
        const lower = query.toLowerCase();
        items = items.filter((exp: any) => String(exp.title || "").toLowerCase().includes(lower));
      }
      if (categoryFilter) {
        items = items.filter((exp: any) => String(exp.category || "") === categoryFilter);
      }
      if (filterProjectId) {
        items = items.filter((exp: any) => String(exp.projectId || "") === filterProjectId);
      }
      if (fromDate) {
        const fromTs = new Date(fromDate).getTime();
        items = items.filter((exp: any) => new Date(exp.date).getTime() >= fromTs);
      }
      if (toDate) {
        const toTs = new Date(toDate).getTime();
        items = items.filter((exp: any) => new Date(exp.date).getTime() <= toTs);
      }
      if (items.length === 0) {
        setError("No matching expenses to delete.");
        return;
      }
      const now = new Date().toISOString();
      const updates = items.map((exp: any) => ({
        ...exp,
        deletedAt: now,
        updatedAt: now,
        version: (exp.version || 1) + 1
      }));
      await db.expenses.bulkPut(updates);
      for (const exp of updates) {
        await enqueueChange(context, {
          entityType: "expense",
          operation: "delete",
          recordId: exp.id,
          serverId: exp.serverId ?? null,
          payload: exp
        });
      }
      setSelectedIds([]);
      setPage(1);
      await loadExpenses(1, query, categoryFilter, filterProjectId, fromDate, toDate, sortBy, sortDir);
    } catch (err: any) {
      setError(err.message || "Failed to delete expenses");
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

  const isRetail = workspace?.businessType === "retail";

  return (
    <>
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.expenses || "Expenses"}</div>
        {loading ? (
          <div className="muted">Loading expenses...</div>
        ) : (
          <>
            <div
              className="filter-row"
              style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}
            >
              <label className="field" style={{ flex: "1 1 240px" }}>
                Search keyword
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. shantumbu" />
              </label>
              <label className="field" style={{ flex: "1 1 180px" }}>
                Category
                {isRetail ? (
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All categories</option>
                    <option value="stock purchase">Stock purchase</option>
                    <option value="utilities">Utilities</option>
                    <option value="transport">Transport</option>
                    <option value="other">Other</option>
                  </select>
                ) : (
                  <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Supplies" />
                )}
              </label>
              {workspace?.projectTrackingEnabled ? (
                <label className="field" style={{ minWidth: 220 }}>
                  Project
                  <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)}>
                    <option value="">All projects</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="field" style={{ minWidth: 160 }}>
                From
                <input value={fromDate} onChange={(e) => setFromDate(e.target.value)} type="date" />
              </label>
              <label className="field" style={{ minWidth: 160 }}>
                To
                <input value={toDate} onChange={(e) => setToDate(e.target.value)} type="date" />
              </label>
              <label className="field" style={{ minWidth: 200 }}>
                Sort by
                <select
                  value={`${sortBy}:${sortDir}`}
                  onChange={(e) => {
                    const [nextBy, nextDir] = e.target.value.split(":");
                    setSortBy(nextBy);
                    setSortDir(nextDir);
                    setPage(1);
                  }}
                >
                  <option value="date:desc">Date (newest first)</option>
                  <option value="date:asc">Date (oldest first)</option>
                  <option value="amount:desc">Amount (high to low)</option>
                  <option value="amount:asc">Amount (low to high)</option>
                  <option value="title:asc">Title (A to Z)</option>
                  <option value="title:desc">Title (Z to A)</option>
                  <option value="category:asc">Category (A to Z)</option>
                  <option value="category:desc">Category (Z to A)</option>
                </select>
              </label>
              <button className="button secondary" onClick={handleSearch}>
                Search
              </button>
              <button className="button secondary" onClick={handleClear}>
                Clear
              </button>
              <button className="button ghost" onClick={handleDeleteAll}>
                Delete all
              </button>
              <button className="button" onClick={() => router.push("/expenses/new")}>
                {isRetail ? "Quick add expense" : "Create expense"}
              </button>
              {error ? <div className="muted">{error}</div> : null}
            </div>

            {workspace?.projectTrackingEnabled ? (
              <div
                className="assign-row"
                style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}
              >
                <label className="field" style={{ minWidth: 220 }}>
                  Add to project
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} />
                  Apply to all filtered results
                </label>
                <button className="button" onClick={handleAssign} disabled={assigning}>
                  {assigning ? "Updating..." : "Add to project"}
                </button>
                {assignSuccess ? <div className="muted">{assignSuccess}</div> : null}
                {assignError ? <div className="muted">{assignError}</div> : null}
                {!applyToAll && selectedIds.length > 0 ? (
                  <div className="muted">Selected: {selectedIds.length}</div>
                ) : null}
              </div>
            ) : null}

            <table className="table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                  </th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                  {workspace?.projectTrackingEnabled ? <th>Project</th> : null}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(expense.id)}
                        onChange={() => toggleSelect(expense.id)}
                        disabled={applyToAll}
                      />
                    </td>
                    <td>{expense.title}</td>
                    <td>{expense.category}</td>
                    <td>{expense.amount.toFixed(2)}</td>
                    <td>{new Date(expense.date).toLocaleDateString()}</td>
                    {workspace?.projectTrackingEnabled ? <td>{expense.projectLabel || "-"}</td> : null}
                    <td>
                      <button className="button secondary" onClick={() => router.push(`/expenses/${expense.id}/edit`)}>
                        Edit
                      </button>
                      <button className="button secondary" onClick={() => handleDelete(expense.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={workspace?.projectTrackingEnabled ? 7 : 6} className="muted">
                      No expenses yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
              <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Prev
              </button>
              <div className="muted">
                Page {page} of {pages}
              </div>
              <button className="button secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
