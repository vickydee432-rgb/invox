"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDownload, apiFetch } from "@/lib/api";

type Quote = {
  _id: string;
  quoteNo: string;
  customerName: string;
  total: number;
  status: string;
  validUntil: string;
};

const LIMIT = 10;

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [shareLink, setShareLink] = useState("");

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

  return (
    <section className="panel">
      <div className="panel-title">Quotes</div>
      {loading ? (
        <div className="muted">Loading quotes...</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <button className="button" onClick={() => router.push("/quotes/new")}>
              Create quote
            </button>
            <button className="button secondary" onClick={handleExport}>
              Export Excel
            </button>
            {shareLink ? <div className="muted">Last link: {shareLink}</div> : null}
            {error ? <div className="muted">{error}</div> : null}
          </div>
          <table className="table">
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
                  <td>{quote.total.toFixed(2)}</td>
                  <td>
                    <span className="badge">{quote.status}</span>
                  </td>
                  <td>{new Date(quote.validUntil).toLocaleDateString()}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="button secondary" onClick={() => router.push(`/quotes/${quote._id}/edit`)}>
                      Edit
                    </button>
                    <button className="button secondary" onClick={() => handleSend(quote._id)}>
                      Send link
                    </button>
                    <button className="button secondary" onClick={() => handlePdf(quote)}>
                      PDF
                    </button>
                    <button className="button secondary" onClick={() => handleDelete(quote)}>
                      Delete
                    </button>
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
  );
}
