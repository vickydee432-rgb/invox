"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Expense = {
  _id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  projectLabel?: string;
};

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

  const loadExpenses = async (
    targetPage = page,
    keyword = query,
    categoryValue = categoryFilter,
    projectValue = filterProjectId,
    fromValue = fromDate,
    toValue = toDate
  ) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", String(LIMIT));
      if (keyword) params.set("q", keyword);
      if (categoryValue) params.set("category", categoryValue);
      if (projectValue) params.set("projectId", projectValue);
      if (fromValue) params.set("from", fromValue);
      if (toValue) params.set("to", toValue);
      const data = await apiFetch<{
        expenses: Expense[];
        page: number;
        pages: number;
      }>(`/api/expenses?${params.toString()}`);
      setExpenses(data.expenses);
      setPage(data.page);
      setPages(data.pages);
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
    loadExpenses(page, query, categoryFilter, filterProjectId, fromDate, toDate);
  }, [page, query, categoryFilter, filterProjectId, fromDate, toDate, workspace]);

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
    return expenses.every((exp) => selectedIds.includes(exp._id));
  }, [expenses, selectedIds]);

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !expenses.some((exp) => exp._id === id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      expenses.forEach((exp) => next.add(exp._id));
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
        : { projectId, expenseIds: selectedIds };
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
      await apiFetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
      await loadExpenses(page, query, categoryFilter, filterProjectId, fromDate, toDate);
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
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
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
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
              <button className="button secondary" onClick={handleSearch}>
                Search
              </button>
              <button className="button secondary" onClick={handleClear}>
                Clear
              </button>
              <button className="button" onClick={() => router.push("/expenses/new")}>
                {isRetail ? "Quick add expense" : "Create expense"}
              </button>
              {error ? <div className="muted">{error}</div> : null}
            </div>

            {workspace?.projectTrackingEnabled ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
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
                  <tr key={expense._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(expense._id)}
                        onChange={() => toggleSelect(expense._id)}
                        disabled={applyToAll}
                      />
                    </td>
                    <td>{expense.title}</td>
                    <td>{expense.category}</td>
                    <td>{expense.amount.toFixed(2)}</td>
                    <td>{new Date(expense.date).toLocaleDateString()}</td>
                    {workspace?.projectTrackingEnabled ? <td>{expense.projectLabel || "-"}</td> : null}
                    <td>
                      <button
                        className="button secondary"
                        onClick={() => router.push(`/expenses/${expense._id}/edit`)}
                      >
                        Edit
                      </button>
                      <button className="button secondary" onClick={() => handleDelete(expense._id)}>
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
