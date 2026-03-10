"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDownload, apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Quote = {
  _id: string;
  quoteNo: string;
  customerName: string;
  total: number;
  status: string;
  validUntil: string;
};

const LIMIT = 10;
const formatMoney = (value: number) => value.toFixed(2);

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [shareLink, setShareLink] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

  const loadQuotes = async (targetPage = page) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{
        quotes: Quote[];
        page: number;
        pages: number;
      }>(`/api/quotes?page=${targetPage}&limit=${LIMIT}`);
      setQuotes(data.quotes);
      setPage(data.page);
      setPages(data.pages);
    } catch (err: any) {
      setError(err.message || "Failed to load quotes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes(page);
  }, [page]);

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

  const handleSend = async (id: string) => {
    try {
      const data = await apiFetch<{ publicUrl: string; publicAppUrl?: string }>(`/api/quotes/${id}/send`, {
        method: "POST"
      });
      const link = data.publicAppUrl || data.publicUrl;
      setShareLink(link);
      window.alert(`Public link: ${link}`);
      await loadQuotes(page);
    } catch (err: any) {
      setError(err.message || "Failed to send quote");
    }
  };

  const handleExport = async () => {
    try {
      const filename = `quotes_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await apiDownload("/api/quotes/export.xlsx", filename);
    } catch (err: any) {
      setError(err.message || "Failed to export quotes");
    }
  };

  const handlePdf = async (quote: Quote) => {
    try {
      const filename = `quote-${quote.quoteNo}.pdf`;
      await apiDownload(`/api/quotes/${quote._id}/pdf`, filename);
    } catch (err: any) {
      setError(err.message || "Failed to download PDF");
    }
  };

  const handleDelete = async (quote: Quote) => {
    const ok = window.confirm(`Delete quote ${quote.quoteNo}? This cannot be undone.`);
    if (!ok) return;
    try {
      await apiFetch(`/api/quotes/${quote._id}`, { method: "DELETE" });
      await loadQuotes(page);
    } catch (err: any) {
      setError(err.message || "Failed to delete quote");
    }
  };

  const renderQuoteActions = (quote: Quote) => (
    <>
      <button className="button secondary" type="button" onClick={() => router.push(`/quotes/${quote._id}/edit`)}>
        Edit
      </button>
      <button className="button secondary" type="button" onClick={() => handleSend(quote._id)}>
        Send link
      </button>
      <button className="button secondary" type="button" onClick={() => handlePdf(quote)}>
        PDF
      </button>
      <button className="button secondary" type="button" onClick={() => handleDelete(quote)}>
        Delete
      </button>
    </>
  );

  if (workspace && !workspace.enabledModules.includes("quotes")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.quotes || "Quotes"}</div>
        <div className="muted">Quotes are disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => router.push("/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">{workspace?.labels?.quotes || "Quotes"}</div>
      {loading ? (
        <div className="muted">Loading quotes...</div>
      ) : (
        <>
          <div className="action-row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <button className="button" type="button" onClick={() => router.push("/quotes/new")}>
              Create quote
            </button>
            <button className="button secondary" type="button" onClick={handleExport}>
              Export Excel
            </button>
            {shareLink ? <div className="muted">Last link: {shareLink}</div> : null}
            {error ? <div className="muted">{error}</div> : null}
          </div>
          <table className="table desktop-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote._id}>
                  <td>{quote.quoteNo}</td>
                  <td>{quote.customerName}</td>
                  <td>{formatMoney(quote.total)}</td>
                  <td>
                    <span className="badge">{quote.status}</span>
                  </td>
                  <td>{new Date(quote.validUntil).toLocaleDateString()}</td>
                  <td>
                    <div className="mobile-inline-actions">{renderQuoteActions(quote)}</div>
                  </td>
                </tr>
              ))}
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No quotes yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="mobile-record-list">
            {quotes.map((quote) => (
              <article key={quote._id} className="mobile-record-card">
                <div className="mobile-record-header">
                  <div>
                    <div className="mobile-record-title">{quote.quoteNo}</div>
                    <div className="mobile-record-subtitle">{quote.customerName}</div>
                  </div>
                  <span className="badge">{quote.status}</span>
                </div>
                <div className="mobile-record-grid">
                  <div className="mobile-record-item">
                    <span className="mobile-record-label">Total</span>
                    <span>{formatMoney(quote.total)}</span>
                  </div>
                  <div className="mobile-record-item">
                    <span className="mobile-record-label">Valid until</span>
                    <span>{new Date(quote.validUntil).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="mobile-record-actions">{renderQuoteActions(quote)}</div>
              </article>
            ))}
            {quotes.length === 0 ? <div className="muted">No quotes yet.</div> : null}
          </div>

          <div className="pagination-row">
            <button className="button secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </button>
            <div className="muted pagination-status">
              Page {page} of {pages}
            </div>
            <button className="button secondary" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
