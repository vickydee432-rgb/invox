"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";
import LedgerPreview, { LedgerPreviewLine } from "@/components/LedgerPreview";

type Supplier = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
};

type SupplierInvoice = {
  _id: string;
  number: string;
  supplierId: string;
  date: string;
  total: number;
  balance: number;
};

type InvoiceItem = {
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
};

export default function PurchasesPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");

  const [invoiceSupplierId, setInvoiceSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", qty: 1, unitPrice: 0, discount: 0, taxRate: 0 }
  ]);

  useEffect(() => {
    if (!invoiceDate) setInvoiceDate(new Date().toISOString().slice(0, 10));
    if (!invoiceDueDate) setInvoiceDueDate(new Date().toISOString().slice(0, 10));
  }, [invoiceDate, invoiceDueDate]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [supplierData, invoiceData] = await Promise.all([
        apiFetch<{ suppliers: Supplier[] }>("/api/purchases/suppliers"),
        apiFetch<{ invoices: SupplierInvoice[] }>("/api/purchases/supplier-invoices")
      ]);
      setSuppliers(supplierData.suppliers || []);
      setInvoices(invoiceData.invoices || []);
      if (!invoiceSupplierId && supplierData.suppliers?.length) {
        setInvoiceSupplierId(supplierData.suppliers[0]._id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load purchases data");
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
    loadData();
  }, []);

  const itemsSubtotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.qty * item.unitPrice - (item.discount || 0)),
    0
  );
  const taxAmount = items.reduce((sum, item) => {
    const line = Math.max(0, item.qty * item.unitPrice - (item.discount || 0));
    return sum + (line * (Number(item.taxRate || 0) / 100));
  }, 0);
  const total = itemsSubtotal + taxAmount;

  const ledgerLines = useMemo(() => {
    const lines: LedgerPreviewLine[] = [
      { accountKey: "purchasesExpense", label: "Purchases expense", debit: itemsSubtotal },
      { accountKey: "accountsPayable", label: "Accounts payable", credit: total }
    ];
    if (taxAmount > 0) {
      lines.splice(1, 0, { accountKey: "vatInput", label: "VAT input", debit: taxAmount });
    }
    return lines;
  }, [itemsSubtotal, taxAmount, total]);

  const updateItem = (index: number, next: Partial<InvoiceItem>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...next } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, discount: 0, taxRate: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const handleCreateSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/purchases/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: supplierName,
          email: supplierEmail || undefined,
          phone: supplierPhone || undefined
        })
      });
      setSupplierName("");
      setSupplierEmail("");
      setSupplierPhone("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create supplier");
    }
  };

  const handleCreateInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/purchases/supplier-invoices", {
        method: "POST",
        body: JSON.stringify({
          supplierId: invoiceSupplierId,
          number: invoiceNumber || `PINV-${Date.now()}`,
          date: invoiceDate,
          dueDate: invoiceDueDate,
          items: items.map((item) => ({
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            taxRate: item.taxRate || 0
          }))
        })
      });
      setInvoiceNumber("");
      setItems([{ description: "", qty: 1, unitPrice: 0, discount: 0, taxRate: 0 }]);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create supplier invoice");
    }
  };

  if (workspace && !workspace.enabledModules.includes("purchases")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.purchases || "Purchases"}</div>
        <div className="muted">Purchases are disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.purchases || "Purchases"}</div>
        <div className="muted">Suppliers, purchase invoices, and GRN-ready workflows.</div>
        {error ? <div className="muted">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-title">Suppliers</div>
        <form onSubmit={handleCreateSupplier} className="grid-2" style={{ marginBottom: 16 }}>
          <label className="field">
            Supplier name
            <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
          </label>
          <label className="field">
            Email
            <input value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} type="email" />
          </label>
          <label className="field">
            Phone
            <input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Add supplier
            </button>
          </div>
        </form>
        {loading ? (
          <div className="muted">Loading suppliers...</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier._id}>
                    <td>{supplier.name}</td>
                    <td>{supplier.email || "-"}</td>
                    <td>{supplier.phone || "-"}</td>
                  </tr>
                ))}
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No suppliers yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Supplier Invoice</div>
        <form onSubmit={handleCreateInvoice} style={{ display: "grid", gap: 16 }}>
          <div className="grid-2">
            <label className="field">
              Supplier
              <select value={invoiceSupplierId} onChange={(e) => setInvoiceSupplierId(e.target.value)}>
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Invoice number
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </label>
            <label className="field">
              Date
              <input value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} type="date" required />
            </label>
            <label className="field">
              Due date
              <input value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} type="date" required />
            </label>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item, index) => (
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
                  Qty
                  <input
                    value={item.qty}
                    onChange={(e) => updateItem(index, { qty: Number(e.target.value) })}
                    type="number"
                    min={0}
                  />
                </label>
                <label className="field">
                  Unit price
                  <input
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
                    type="number"
                    min={0}
                  />
                </label>
                <label className="field">
                  Discount
                  <input
                    value={item.discount || 0}
                    onChange={(e) => updateItem(index, { discount: Number(e.target.value) })}
                    type="number"
                    min={0}
                  />
                </label>
                <label className="field">
                  Tax rate %
                  <input
                    value={item.taxRate || 0}
                    onChange={(e) => updateItem(index, { taxRate: Number(e.target.value) })}
                    type="number"
                    min={0}
                  />
                </label>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button className="button secondary" type="button" onClick={() => removeItem(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button className="button secondary" type="button" onClick={addItem}>
              Add line
            </button>
          </div>

          <div className="badge">Total {total.toFixed(2)}</div>
          <button className="button" type="submit">
            Create supplier invoice
          </button>
        </form>
      </section>

      {workspace?.enabledModules?.includes("accounting") ? (
        <LedgerPreview title="Ledger impact" lines={ledgerLines} />
      ) : null}

      <section className="panel">
        <div className="panel-title">Recent Supplier Invoices</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Total</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice._id}>
                  <td>{invoice.number}</td>
                  <td>{new Date(invoice.date).toLocaleDateString()}</td>
                  <td>{Number(invoice.total || 0).toFixed(2)}</td>
                  <td>{Number(invoice.balance || 0).toFixed(2)}</td>
                </tr>
              ))}
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No supplier invoices yet.
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
