"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type QuoteItem = {
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
  lineTotal?: number;
};

type Quote = {
  _id: string;
  quoteNo: string;
  customerName: string;
  status: string;
  issueDate: string;
  validUntil: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes?: string;
  terms?: string;
  items: QuoteItem[];
};

type Invoice = {
  invoiceNo: string;
  total: number;
  dueDate: string;
};

type Company = {
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
};

export default function PublicQuotePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadQuote = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ quote: Quote; company?: Company }>(`/api/quotes/public/${token}`);
      setQuote(data.quote);
      setCompany(data.company || null);
    } catch (err: any) {
      setError(err.message || "Invalid or expired link");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuote();
  }, [token]);

  const handleAccept = async () => {
    setWorking(true);
    setError("");
    try {
      const data = await apiFetch<{ quote: Quote; invoice?: Invoice }>(
        `/api/quotes/public/${token}/accept`,
        { method: "POST" }
      );
      setQuote(data.quote);
      if (data.invoice) setInvoice(data.invoice);
    } catch (err: any) {
      setError(err.message || "Failed to accept quote");
    } finally {
      setWorking(false);
    }
  };

  const handleDecline = async () => {
    setWorking(true);
    setError("");
    try {
      const data = await apiFetch<{ quote: Quote }>(`/api/quotes/public/${token}/decline`, {
        method: "POST"
      });
      setQuote(data.quote);
    } catch (err: any) {
      setError(err.message || "Failed to decline quote");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div className="panel">Loading quote...</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div className="panel">
          <div className="panel-title">Quote not available</div>
          <p className="muted">{error || "This link may be expired."}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 24 }}>
        <div className="panel">
          <div className="panel-title">Quote {quote.quoteNo}</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
            <div>
              <div className="muted">Customer</div>
              <div>{quote.customerName}</div>
            </div>
            {company ? (
              <div>
                <div className="muted">From</div>
                <div>{company.legalName || company.name}</div>
                {company.email ? <div className="muted">{company.email}</div> : null}
                {company.phone ? <div className="muted">{company.phone}</div> : null}
                {company.website ? <div className="muted">{company.website}</div> : null}
              </div>
            ) : null}
            <div>
              <div className="muted">Valid until</div>
              <div>{new Date(quote.validUntil).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="muted">Status</div>
              <div className="badge">{quote.status}</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Items</div>
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Discount</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.description}</td>
                  <td>{item.qty}</td>
                  <td>{item.unitPrice.toFixed(2)}</td>
                  <td>{(item.discount || 0).toFixed(2)}</td>
                  <td>{(item.lineTotal ?? item.qty * item.unitPrice - (item.discount || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
            <div>Subtotal: {quote.subtotal.toFixed(2)}</div>
            <div>
              VAT ({quote.vatRate}%): {quote.vatAmount.toFixed(2)}
            </div>
            <div>
              <strong>Total: {quote.total.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {quote.notes ? (
          <div className="panel">
            <div className="panel-title">Notes</div>
            <p className="muted">{quote.notes}</p>
          </div>
        ) : null}

        {quote.terms ? (
          <div className="panel">
            <div className="panel-title">Terms</div>
            <p className="muted">{quote.terms}</p>
          </div>
        ) : null}

        <div className="panel">
          <div className="panel-title">Decision</div>
          {error ? <div className="muted">{error}</div> : null}
          {invoice ? (
            <div className="muted">
              Invoice created: {invoice.invoiceNo} · Total {invoice.total.toFixed(2)} · Due{" "}
              {new Date(invoice.dueDate).toLocaleDateString()}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className="button"
                onClick={handleAccept}
                disabled={working || quote.status === "accepted" || quote.status === "declined"}
              >
                {working ? "Processing..." : "Accept quote"}
              </button>
              <button
                className="button secondary"
                onClick={handleDecline}
                disabled={working || quote.status === "accepted" || quote.status === "declined"}
              >
                Decline
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
