"use client";

import { useEffect, useState } from "react";
import { apiDownload, apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Project = {
  _id: string;
  name: string;
  description?: string;
  isActive?: boolean;
};

type Summary = {
  billed: number;
  paid: number;
  expenses: number;
  profit_on_paid: number;
  profit_on_billed: number;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ projects: Project[] }>("/api/projects");
      setProjects(data.projects);
      if (!selectedId && data.projects[0]?._id) setSelectedId(data.projects[0]._id);
    } catch (err: any) {
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

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
    if (!selectedId) {
      setSummary(null);
      return;
    }
    apiFetch<Summary>(`/api/projects/${selectedId}/summary`)
      .then((data) => setSummary(data))
      .catch(() => setSummary(null));
  }, [selectedId]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setIsActive(true);
  };

  const startEdit = (project: Project) => {
    setEditingId(project._id);
    setName(project.name);
    setDescription(project.description || "");
    setIsActive(project.isActive ?? true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await apiFetch(`/api/projects/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ name, description: description || undefined, isActive })
        });
      } else {
        await apiFetch("/api/projects", {
          method: "POST",
          body: JSON.stringify({ name, description: description || undefined })
        });
      }
      resetForm();
      await loadProjects();
    } catch (err: any) {
      setError(err.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: Project) => {
    const ok = window.confirm(`Delete project ${project.name}? This cannot be undone.`);
    if (!ok) return;
    try {
      await apiFetch(`/api/projects/${project._id}`, { method: "DELETE" });
      if (selectedId === project._id) {
        setSelectedId("");
        setSummary(null);
      }
      await loadProjects();
    } catch (err: any) {
      setError(err.message || "Failed to delete project");
    }
  };

  const handleExport = async () => {
    if (!selectedId) return;
    setExporting(true);
    setExportError("");
    try {
      const params = new URLSearchParams();
      if (openingBalance.trim()) {
        params.set("openingBalance", openingBalance.trim());
      }
      const selectedProject = projects.find((project) => project._id === selectedId);
      const safeName = (selectedProject?.name || "project").replace(/[^a-z0-9_-]+/gi, "_");
      const filename = `project-${safeName}-expenses.xlsx`;
      const query = params.toString();
      await apiDownload(`/api/projects/${selectedId}/expenses/export.xlsx${query ? `?${query}` : ""}`, filename);
    } catch (err: any) {
      setExportError(err.message || "Failed to export project expenses");
    } finally {
      setExporting(false);
    }
  };

  if (workspace && !workspace.projectTrackingEnabled) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.projects || "Projects"}</div>
        <div className="muted">Project tracking is disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">{editingId ? "Edit Project" : "Create Project"}</div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div className="grid-2">
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Description
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            {editingId ? (
              <label className="field">
                Active
                <select value={isActive ? "yes" : "no"} onChange={(e) => setIsActive(e.target.value === "yes")}>
                  <option value="yes">Active</option>
                  <option value="no">Inactive</option>
                </select>
              </label>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update project" : "Create project"}
            </button>
            {editingId ? (
              <button className="button secondary" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
          {error ? <div className="muted">{error}</div> : null}
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">Project Summary</div>
        <div className="grid-2">
          <label className="field">
            Project
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Opening balance (optional)
            <input
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="e.g. 200000"
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button className="button secondary" onClick={handleExport} disabled={!selectedId || exporting}>
            {exporting ? "Exporting..." : "Export Project Excel"}
          </button>
          {exportError ? <div className="muted">{exportError}</div> : null}
        </div>
        {summary ? (
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <div>Billed: {summary.billed.toFixed(2)}</div>
            <div>Paid: {summary.paid.toFixed(2)}</div>
            <div>Expenses: {summary.expenses.toFixed(2)}</div>
            <div>Profit on paid: {summary.profit_on_paid.toFixed(2)}</div>
            <div>Profit on billed: {summary.profit_on_billed.toFixed(2)}</div>
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 14 }}>
            Select a project to see summary.
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">{workspace?.labels?.projects || "Projects"}</div>
        {loading ? (
          <div className="muted">Loading projects...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project._id}>
                  <td>{project.name}</td>
                  <td>{project.description || "-"}</td>
                  <td>{project.isActive === false ? "Inactive" : "Active"}</td>
                  <td>
                    <button className="button secondary" onClick={() => startEdit(project)}>
                      Edit
                    </button>
                    <button className="button secondary" onClick={() => handleDelete(project)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No projects yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
