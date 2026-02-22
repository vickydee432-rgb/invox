"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type InvoiceItem = {
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
};

type Invoice = {
  _id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone?: string;
  customerTpin?: string;
  issueDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  items: InvoiceItem[];
};

type Company = {
  name: string;
  legalName?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  phone?: string;
  email?: string;
  taxId?: string;
  currency?: string;
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiFetch<{ invoice: Invoice }>(`/api/invoices/${id}`),
      apiFetch<{ company: any }>("/api/company/me")
    ])
      .then(([invoiceData, companyData]) => {
        if (!active) return;
        setInvoice(invoiceData.invoice);
        setCompany(companyData.company);
        setWorkspace(buildWorkspace(companyData.company));
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err.message || "Failed to load receipt");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="panel">
        <div className="panel-title">Receipt</div>
        <div className="muted">Loading receipt...</div>
      </section>
    );
  }

  if (error || !invoice || !company) {
    return (
      <section className="panel">
        <div className="panel-title">Receipt</div>
        <div className="muted">{error || "Receipt not found."}</div>
        <button className="button secondary" type="button" onClick={() => router.push("/invoices")}>
          Back to list
        </button>
      </section>
    );
  }

  const currency = company.currency || "USD";
  const label = workspace?.labels?.invoiceSingular || "Receipt";

  return (
    <section className="panel receipt-page">
      <div className="receipt-toolbar">
        <button className="button secondary" type="button" onClick={() => router.push("/invoices")}>
          Back
        </button>
        <button className="button" type="button" onClick={() => window.print()}>
          Print {label}
        </button>
      </div>

      <div className="receipt-sheet">
        <div className="receipt-header">
          <div>
            <div className="receipt-title">{company.name}</div>
            <div className="receipt-meta">{company.legalName || ""}</div>
            <div className="receipt-meta">
              {company.address?.line1 || ""} {company.address?.line2 || ""}
            </div>
            <div className="receipt-meta">
              {company.address?.city || ""} {company.address?.state || ""} {company.address?.postalCode || ""}
            </div>
            <div className="receipt-meta">{company.address?.country || ""}</div>
            <div className="receipt-meta">{company.phone || ""}</div>
            <div className="receipt-meta">{company.email || ""}</div>
          </div>
          <div className="receipt-block">
            <div className="receipt-label">{label}</div>
            <div className="receipt-meta">No: {invoice.invoiceNo}</div>
            <div className="receipt-meta">Date: {formatDate(invoice.issueDate)}</div>
            <div className="receipt-meta">Status: {invoice.status}</div>
          </div>
        </div>

        <div className="receipt-divider" />

        <div className="receipt-section">
          <div className="receipt-meta">Customer: {invoice.customerName}</div>
          {invoice.customerPhone ? <div className="receipt-meta">Phone: {invoice.customerPhone}</div> : null}
          {invoice.customerTpin ? <div className="receipt-meta">TPIN: {invoice.customerTpin}</div> : null}
        </div>

        <div className="receipt-divider" />

        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => {
              const lineTotal = Math.max(0, item.qty * item.unitPrice - (item.discount || 0));
              return (
                <tr key={`${item.description}-${index}`}>
                  <td>{item.description}</td>
                  <td>{item.qty}</td>
                  <td>
                    {currency} {item.unitPrice.toFixed(2)}
                  </td>
                  <td>
                    {currency} {lineTotal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="receipt-divider" />

        <div className="receipt-totals">
          <div>
            <span>Subtotal</span>
            <strong>
              {currency} {invoice.subtotal.toFixed(2)}
            </strong>
          </div>
          {invoice.vatRate > 0 ? (
            <div>
              <span>VAT ({invoice.vatRate}%)</span>
              <strong>
                {currency} {invoice.vatAmount.toFixed(2)}
              </strong>
            </div>
          ) : null}
          <div className="receipt-total-row">
            <span>Total</span>
            <strong>
              {currency} {invoice.total.toFixed(2)}
            </strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>
              {currency} {invoice.amountPaid.toFixed(2)}
            </strong>
          </div>
          <div>
            <span>Balance</span>
            <strong>
              {currency} {invoice.balance.toFixed(2)}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
