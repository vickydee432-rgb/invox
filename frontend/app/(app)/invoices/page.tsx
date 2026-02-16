"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiDownload, apiFetch } from "@/lib/api";

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
  customerTpin?: string;
  total: number;
  amountPaid: number;
  balance: number;
  status: string;
  dueDate: string;
  vatRate: number;
  items: InvoiceItem[];
};

const LIMIT = 10;

const toDateInputValue = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [selectedId, setSelectedId] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [updating, setUpdating] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editInvoiceNo, setEditInvoiceNo] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerTpin, setEditCustomerTpin] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState("sent");
  const [editVatRate, setEditVatRate] = useState(0);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([
    { description: "", qty: 1, unitPrice: 0, discount: 0 }
  ]);
  const [saving, setSaving] = useState(false);

  const loadInvoices = async (targetPage = page) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{
        invoices: Invoice[];
        page: number;
        pages: number;
      }>(`/api/invoices?page=${targetPage}&limit=${LIMIT}`);
      setInvoices(data.invoices);
      setPage(data.page);
      setPages(data.pages);
      if (!selectedId && data.invoices[0]?._id) setSelectedId(data.invoices[0]._id);
    } catch (err: any) {
      setError(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices(page);
  }, [page]);

  const startEdit = (invoice: Invoice) => {
    setEditId(invoice._id);
    setEditInvoiceNo(invoice.invoiceNo);
    setEditCustomerName(invoice.customerName);
    setEditCustomerTpin(invoice.customerTpin || "");
    setEditDueDate(toDateInputValue(invoice.dueDate));
    setEditStatus(invoice.status);
    setEditVatRate(invoice.vatRate ?? 0);
    setEditItems(
      (invoice.items || []).map((item) => ({
        description: item.description,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discount: item.discount ?? 0
      }))
    );
    setShowEdit(true);
  };

  const resetEdit = () => {
    setEditId(null);
    setEditInvoiceNo("");
    setEditCustomerName("");
    setEditCustomerTpin("");
    setEditDueDate("");
    setEditStatus("sent");
    setEditVatRate(0);
    setEditItems([{ description: "", qty: 1, unitPrice: 0, discount: 0 }]);
    setShowEdit(false);
  };

  const updateItem = (index: number, patch: Partial<InvoiceItem>) => {
    setEditItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setEditItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, discount: 0 }]);
  };

  const removeItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editId) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/invoices/${editId}`, {
        method: "PUT",
        body: JSON.stringify({
          customerName: editCustomerName,
          customerTpin: editCustomerTpin || undefined,
          dueDate: editDueDate,
          status: editStatus,
          vatRate: editVatRate,
          items: editItems
        })
      });
      resetEdit();
      await loadInvoices(page);
    } catch (err: any) {
      setError(err.message || "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    setUpdating(true);
    setError("");
    try {
      await apiFetch(`/api/invoices/${selectedId}/payment`, {
        method: "POST",
        body: JSON.stringify({ amountPaid })
      });
      setAmountPaid(0);
      await loadInvoices(page);
    } catch (err: any) {
      setError(err.message || "Failed to update payment");
    } finally {
      setUpdating(false);
    }
  };

  const handleExport = async () => {
    try {
      const filename = `invoices_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await apiDownload("/api/invoices/export.xlsx", filename);
    } catch (err: any) {
      setError(err.message || "Failed to export invoices");
    }
  };

  const handlePdf = async (invoice: Invoice) => {
    try {
      const filename = `invoice-${invoice.invoiceNo}.pdf`;
      await apiDownload(`/api/invoices/${invoice._id}/pdf`, filename);
    } catch (err: any) {
      setError(err.message || "Failed to download PDF");
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    const ok = window.confirm(`Delete invoice ${invoice.invoiceNo}? This cannot be undone.`);
    if (!ok) return;
    try {
      await apiFetch(`/api/invoices/${invoice._id}`, { method: "DELETE" });
      if (editId === invoice._id) resetEdit();
      await loadInvoices(page);
    } catch (err: any) {
      setError(err.message || "Failed to delete invoice");
    }
  };

  return (
    <>
      <section className="panel">
        <div className="panel-title">Update Payment</div>
        <form onSubmit={handlePayment} style={{ display: "grid", gap: 16 }}>
          <div className="grid-2">
            <label className="field">
              Invoice
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {invoices.map((inv) => (
                  <option key={inv._id} value={inv._id}>
                    {inv.invoiceNo} · {inv.customerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Amount paid
              <input
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                type="number"
                min={0}
                required
              />
            </label>
          </div>
          <button className="button" type="submit" disabled={updating || !selectedId}>
            {updating ? "Updating..." : "Save payment"}
          </button>
        </form>
      </section>

      <section className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="panel-title">{editId ? "Edit Invoice" : "Edit an Invoice"}</div>
          {editId ? (
            <button className="button secondary" type="button" onClick={() => setShowEdit((prev) => !prev)}>
              {showEdit ? "Hide" : "Open"}
            </button>
          ) : null}
        </div>
        {showEdit && editId ? (
          <form onSubmit={handleEditSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
            <div className="grid-2">
              <label className="field">
                Invoice number
                <input value={editInvoiceNo} readOnly />
              </label>
              <label className="field">
                Customer name
                <input
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                Customer TPIN
                <input value={editCustomerTpin} onChange={(e) => setEditCustomerTpin(e.target.value)} />
              </label>
              <label className="field">
                Due date
                <input
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  type="date"
                  required
                />
              </label>
              <label className="field">
                Status
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="draft">draft</option>
                  <option value="sent">sent</option>
                  <option value="partial">partial</option>
                  <option value="paid">paid</option>
                  <option value="overdue">overdue</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>
              <label className="field">
                VAT rate %
                <input
                  value={editVatRate}
                  onChange={(e) => setEditVatRate(Number(e.target.value))}
                  type="number"
                  min={0}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {editItems.map((item, index) => (
                <div key={index} className="grid-2">
                  <label className="field">
                    Description
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    Quantity
                    <input
                      value={item.qty}
                      onChange={(e) => updateItem(index, { qty: Number(e.target.value) })}
                      type="number"
                      min={0}
                      required
                    />
                  </label>
                  <label className="field">
                    Unit price
                    <input
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
                      type="number"
                      min={0}
                      required
                    />
                  </label>
                  <label className="field">
                    Discount
                    <input
                      value={item.discount ?? 0}
                      onChange={(e) => updateItem(index, { discount: Number(e.target.value) })}
                      type="number"
                      min={0}
                    />
                  </label>
                  {editItems.length > 1 ? (
                    <button className="button secondary" type="button" onClick={() => removeItem(index)}>
                      Remove item
                    </button>
                  ) : null}
                </div>
              ))}
              <button className="button secondary" type="button" onClick={addItem}>
                Add item
              </button>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button className="button" type="submit" disabled={!editId || saving}>
                {saving ? "Saving..." : "Update invoice"}
              </button>
              {editId ? (
                <button className="button secondary" type="button" onClick={resetEdit}>
                  Cancel edit
                </button>
              ) : null}
              {editId ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    const current = invoices.find((inv) => inv._id === editId);
                    if (current) handleDelete(current);
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="muted" style={{ marginTop: 12 }}>
            Select an invoice and click Edit to open.
          </div>
        )}
        {error ? <div className="muted">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-title">Invoices</div>
        {loading ? (
          <div className="muted">Loading invoices...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <Link className="button" href="/invoices/new">
                Create invoice
              </Link>
              <button className="button secondary" onClick={handleExport}>
                Export Excel
              </button>
              {error ? <div className="muted">{error}</div> : null}
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td>{invoice.invoiceNo}</td>
                    <td>{invoice.customerName}</td>
                    <td>{invoice.total.toFixed(2)}</td>
                    <td>{invoice.amountPaid.toFixed(2)}</td>
                    <td>{invoice.balance.toFixed(2)}</td>
                    <td>
                      <span className="badge">{invoice.status}</span>
                    </td>
                    <td>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button className="button secondary" onClick={() => startEdit(invoice)}>
                        Edit
                      </button>
                      <button className="button secondary" onClick={() => handlePdf(invoice)}>
                        PDF
                      </button>
                      <button className="button secondary" onClick={() => handleDelete(invoice)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      No invoices yet.
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
