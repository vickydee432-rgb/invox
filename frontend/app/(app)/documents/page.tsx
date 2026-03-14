"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type DocumentFile = {
  _id: string;
  fileName: string;
  fileUrl: string;
  mime?: string;
  size?: number;
  tags?: string[];
};

export default function DocumentsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [error, setError] = useState("");

  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileMime, setFileMime] = useState("");
  const [fileTags, setFileTags] = useState("");

  const [linkFileId, setLinkFileId] = useState("");
  const [linkEntityType, setLinkEntityType] = useState("");
  const [linkEntityId, setLinkEntityId] = useState("");

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

  const handleCreateFile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const result = await apiFetch<{ file: DocumentFile }>("/api/documents/files", {
        method: "POST",
        body: JSON.stringify({
          fileName,
          fileUrl,
          mime: fileMime || undefined,
          tags: fileTags
            ? fileTags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : []
        })
      });
      setFiles((prev) => [result.file, ...prev]);
      setFileName("");
      setFileUrl("");
      setFileMime("");
      setFileTags("");
      setLinkFileId(result.file._id);
    } catch (err: any) {
      setError(err.message || "Failed to save document");
    }
  };

  const handleLinkDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/documents/document-links", {
        method: "POST",
        body: JSON.stringify({
          fileId: linkFileId,
          entityType: linkEntityType,
          entityId: linkEntityId
        })
      });
      setLinkEntityType("");
      setLinkEntityId("");
    } catch (err: any) {
      setError(err.message || "Failed to link document");
    }
  };

  if (workspace && !workspace.enabledModules.includes("documents")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.documents || "Documents"}</div>
        <div className="muted">Documents are disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.documents || "Documents"}</div>
        <div className="muted">Store receipts, invoices, and supporting documents.</div>
        {error ? <div className="muted">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-title">Upload Document Link</div>
        <form onSubmit={handleCreateFile} className="grid-2">
          <label className="field">
            File name
            <input value={fileName} onChange={(e) => setFileName(e.target.value)} required />
          </label>
          <label className="field">
            File URL
            <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} required />
          </label>
          <label className="field">
            MIME type
            <input value={fileMime} onChange={(e) => setFileMime(e.target.value)} placeholder="application/pdf" />
          </label>
          <label className="field">
            Tags
            <input value={fileTags} onChange={(e) => setFileTags(e.target.value)} placeholder="receipt, vat" />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Save document
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">Link Document to Transaction</div>
        <form onSubmit={handleLinkDocument} className="grid-2">
          <label className="field">
            File
            <select value={linkFileId} onChange={(e) => setLinkFileId(e.target.value)}>
              <option value="">Select file</option>
              {files.map((file) => (
                <option key={file._id} value={file._id}>
                  {file.fileName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Entity type
            <input value={linkEntityType} onChange={(e) => setLinkEntityType(e.target.value)} placeholder="expense" />
          </label>
          <label className="field">
            Entity ID
            <input value={linkEntityId} onChange={(e) => setLinkEntityId(e.target.value)} placeholder="ObjectId" />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Link document
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">Recent Uploads</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>URL</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file._id}>
                  <td>{file.fileName}</td>
                  <td>{file.fileUrl}</td>
                  <td>{file.tags?.join(", ") || "-"}</td>
                </tr>
              ))}
              {files.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No documents saved yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
