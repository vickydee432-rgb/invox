"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type InvoiceItem = {
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
};

type Project = {
  _id: string;
  name: string;
};

export default function NewInvoicePage() {
  const router = useRouter();
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [pasteSuccess, setPasteSuccess] = useState("");
  const [pasteErrors, setPasteErrors] = useState<{ line: number; error: string; raw: string }[]>([]);
  const [appendItems, setAppendItems] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<{ createdCount: number; errors?: { row: number; error: string }[] } | null>(
    null
  );
  const [importStatus, setImportStatus] = useState("");
  const [dueDatePreference, setDueDatePreference] = useState("date");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTpin, setCustomerTpin] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shipBy, setShipBy] = useState("");
  const [trackingRef, setTrackingRef] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingTaxRate, setShippingTaxRate] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectLabel, setProjectLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("sent");
  const [vatRate, setVatRate] = useState(0);
  const [activeTab, setActiveTab] = useState<"billing" | "shipping">("billing");
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", qty: 1, unitPrice: 0, discount: 0 }
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const itemsSubtotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.qty * item.unitPrice - (item.discount || 0)),
    0
  );
  const shippingValue = Number(shippingCost) || 0;
  const shippingVat = (shippingValue * (Number(shippingTaxRate) || 0)) / 100;
  const subtotal = itemsSubtotal + shippingValue;
  const vatAmount = (itemsSubtotal * (Number(vatRate) || 0)) / 100 + shippingVat;
  const total = subtotal + vatAmount;

  useEffect(() => {
    if (sameAsBilling) {
      setShippingAddress(billingAddress);
    }
  }, [sameAsBilling, billingAddress]);

  useEffect(() => {
    let mounted = true;
    apiFetch<{ projects: Project[] }>("/api/projects")
      .then((data) => {
        if (mounted) setProjects(data.projects || []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const normalizeLine = (line: string) =>
    line
      .replace(/[\u200B-\u200F\uFEFF\u2060\u00AD\u202A-\u202E\u2066-\u2069]/g, "")
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
      .trim();

  const parseAmount = (value: string) => {
    const normalized = String(value).replace(/[,]/g, "").replace(/[^\d.-]/g, "");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : NaN;
  };

  const splitColumns = (line: string) => {
    if (line.includes("\t")) {
      return line
        .split(/\t+/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    if (/\s{2,}/.test(line)) {
      return line
        .split(/\s{2,}/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return null;
  };

  const detectHeaderMap = (line: string) => {
    const normalized = line.toLowerCase();
    const hasDesc = normalized.includes("description") || normalized.includes("item");
    const hasQty = normalized.includes("qty") || normalized.includes("quantity");
    const hasPrice = normalized.includes("unit") || normalized.includes("price");
    if (!hasDesc || !hasQty || !hasPrice) return null;

    const parts = splitColumns(line);
    if (!parts || parts.length < 3) return { map: null, isHeader: true };
    const map: { description?: number; qty?: number; unitPrice?: number; discount?: number } = {};
    parts.forEach((part, index) => {
      const value = part.toLowerCase();
      if (value.includes("description") || value.includes("item")) map.description = index;
      if (value.includes("qty") || value.includes("quantity")) map.qty = index;
      if (value.includes("unit") || value.includes("price")) map.unitPrice = index;
      if (value.includes("discount")) map.discount = index;
    });
    if (map.description === undefined || map.qty === undefined || map.unitPrice === undefined) {
      return { map: null, isHeader: true };
    }
    return { map, isHeader: true };
  };

  const parseFromColumns = (
    columns: string[],
    headerMap: { description?: number; qty?: number; unitPrice?: number; discount?: number } | null
  ) => {
    if (headerMap) {
      const description = columns[headerMap.description ?? 0] || "";
      const qty = parseAmount(columns[headerMap.qty ?? 1]);
      const unitPrice = parseAmount(columns[headerMap.unitPrice ?? 2]);
      const discount = headerMap.discount !== undefined ? parseAmount(columns[headerMap.discount]) : 0;
      if (!description) return { error: "Missing description" };
      if (!Number.isFinite(qty) || qty <= 0) return { error: "Invalid quantity" };
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Invalid unit price" };
      if (!Number.isFinite(discount) || discount < 0) return { error: "Invalid discount" };
      return { item: { description, qty, unitPrice, discount } };
    }

    const numericIndexes = columns
      .map((value, index) => ({ value, index, num: parseAmount(value) }))
      .filter((entry) => Number.isFinite(entry.num));
    if (numericIndexes.length < 2) return { error: "Missing quantity or unit price" };

    const take = numericIndexes.length >= 3 ? 3 : 2;
    const nums = numericIndexes.slice(-take);
    const qty = nums[0].num;
    const unitPrice = nums[1].num;
    const discount = take === 3 ? nums[2].num : 0;
    const description = columns.slice(0, nums[0].index).join(" ").trim();
    if (!description) return { error: "Missing description" };
    if (!Number.isFinite(qty) || qty <= 0) return { error: "Invalid quantity" };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Invalid unit price" };
    if (!Number.isFinite(discount) || discount < 0) return { error: "Invalid discount" };
    return { item: { description, qty, unitPrice, discount } };
  };

  const parseItemLine = (
    line: string,
    headerMap: { description?: number; qty?: number; unitPrice?: number; discount?: number } | null
  ) => {
    if (!line) return { error: "Empty line" };
    const lower = line.toLowerCase();
    if (lower.includes("description") && (lower.includes("qty") || lower.includes("quantity"))) {
      return { error: "Header row" };
    }

    const columns = splitColumns(line);
    if (columns && columns.length >= 3) {
      const result = parseFromColumns(columns, headerMap);
      if (!result.error) return result;
    }

    if (line.includes("|")) {
      const parts = line
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length < 3) return { error: "Expected: description | qty | unit price | discount" };
      return parseFromColumns(parts, null);
    }

    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) return { error: "Expected: description qty unit price" };
    const qty = parseAmount(tokens[tokens.length - 2]);
    const unitPrice = parseAmount(tokens[tokens.length - 1]);
    const description = tokens.slice(0, -2).join(" ").trim();
    if (!description) return { error: "Missing description" };
    if (!Number.isFinite(qty) || qty <= 0) return { error: "Invalid quantity" };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Invalid unit price" };
    return { item: { description, qty, unitPrice, discount: 0 } };
  };

  const handlePasteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pasteText.trim()) return;
    setPasteError("");
    setPasteSuccess("");
    setPasteErrors([]);

    const rawLines = pasteText
      .split(/\r?\n/)
      .map((line) => normalizeLine(line))
      .filter((line) => line.length > 0);

    let lines = rawLines;
    let headerMap: { description?: number; qty?: number; unitPrice?: number; discount?: number } | null = null;
    if (lines.length > 0) {
      const header = detectHeaderMap(lines[0]);
      if (header?.isHeader) {
        headerMap = header.map;
        lines = lines.slice(1);
      }
    }

    const nextItems: InvoiceItem[] = [];
    const errors: { line: number; error: string; raw: string }[] = [];
    lines.forEach((line, index) => {
      const result = parseItemLine(line, headerMap);
      if (result.error) {
        if (result.error !== "Header row") {
          errors.push({ line: index + 1, error: result.error, raw: line });
        }
        return;
      }
      if (result.item) nextItems.push(result.item);
    });

    if (nextItems.length === 0) {
      setPasteError("No valid items found.");
      setPasteErrors(errors);
      return;
    }

    setItems((prev) => (appendItems ? [...prev, ...nextItems] : nextItems));
    setPasteSuccess(`Imported ${nextItems.length} items.`);
    setPasteErrors(errors);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(importFile);
      });
      const data = await apiFetch<{ createdCount: number; errors?: { row: number; error: string }[] }>(
        "/api/invoices/import",
        {
          method: "POST",
          body: JSON.stringify({
            base64,
            defaultStatus: importStatus || undefined,
            dueDatePreference
          })
        }
      );
      setImportResult(data);
    } catch (err: any) {
      setImportError(err.message || "Failed to import invoices");
    } finally {
      setImporting(false);
    }
  };

  const updateItem = (index: number, patch: Partial<InvoiceItem>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, discount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          invoiceNo: invoiceNo || undefined,
          customerName,
          customerPhone: customerPhone || undefined,
          customerTpin: customerTpin || undefined,
          billingAddress: billingAddress || undefined,
          shippingAddress: shippingAddress || undefined,
          sameAsBilling,
          shipBy: shipBy || undefined,
          trackingRef: trackingRef || undefined,
          shippingCost: Number(shippingCost) || 0,
          shippingTaxRate: Number(shippingTaxRate) || 0,
          projectId: projectId || undefined,
          projectLabel: projectLabel || undefined,
          dueDate,
          status,
          vatRate,
          items
        })
      });
      router.push("/invoices");
    } catch (err: any) {
      setError(err.message || "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="panel-title">Utilities</div>
          <button className="button secondary" type="button" onClick={() => setShowPaste((prev) => !prev)}>
            {showPaste ? "Hide" : "Show"}
          </button>
        </div>
        {showPaste ? (
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <div className="panel-title" style={{ fontSize: 16, marginBottom: 8 }}>
                Import Invoices (Excel)
              </div>
              <div className="muted" style={{ marginBottom: 12 }}>
                Required columns: Customer Name, Due Date or Date, Description, Qty, Unit Price.
                Optional: Invoice No, Customer Phone, Customer TPIN, Status, VAT Rate, Discount.
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <label className="field" style={{ minWidth: 220 }}>
                  Import status
                  <select value={importStatus} onChange={(e) => setImportStatus(e.target.value)}>
                    <option value="">Use sheet status</option>
                    <option value="sent">Sent (unpaid)</option>
                    <option value="paid">Paid</option>
                    <option value="draft">Draft</option>
                  </select>
                </label>
                <label className="field" style={{ minWidth: 240 }}>
                  Due date from
                  <select value={dueDatePreference} onChange={(e) => setDueDatePreference(e.target.value)}>
                    <option value="date">Use Date column</option>
                    <option value="dueDate">Use Due Date column</option>
                    <option value="auto">Use Due Date, else Date</option>
                  </select>
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <button className="button" onClick={handleImport} disabled={!importFile || importing}>
                  {importing ? "Importing..." : "Import Excel"}
                </button>
                {importError ? <div className="muted">{importError}</div> : null}
                {importResult ? (
                  <div className="muted">
                    {importResult.createdCount > 0
                      ? `Imported ${importResult.createdCount} invoices.`
                      : "No invoices created."}
                  </div>
                ) : null}
              </div>
              {importResult?.errors && importResult.errors.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div className="muted">Some rows could not be imported:</div>
                  <ul style={{ marginTop: 8, paddingLeft: 18, listStyle: "disc" }}>
                    {importResult.errors.map((err, idx) => (
                      <li key={`${err.row}-${err.error}-${idx}`} className="muted">
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div>
              <div className="panel-title" style={{ fontSize: 16, marginBottom: 8 }}>
                Quick Paste Items
              </div>
              <p className="muted" style={{ marginBottom: 12 }}>
                Paste one item per line. Supported formats:
                <br />
                <strong>Description | Qty | Unit Price | Discount</strong> (discount optional), or
                <br />
                a pasted table with headers like <strong>Description</strong>, <strong>Qty</strong>,
                <strong>Unit Price</strong> (extra columns are ignored).
              </p>
              <form onSubmit={handlePasteSubmit} style={{ display: "grid", gap: 12 }}>
                <label className="field">
                  Paste items
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={6}
                    placeholder="Cement | 10 | 145.50 | 0"
                  />
                </label>
                <label className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={appendItems}
                    onChange={(e) => setAppendItems(e.target.checked)}
                  />
                  Append to existing items
                </label>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="button" type="submit">
                    Import items
                  </button>
                  {pasteSuccess ? <div className="muted">{pasteSuccess}</div> : null}
                  {pasteError ? <div className="muted">{pasteError}</div> : null}
                </div>
              </form>
              {pasteErrors.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div className="muted">Some lines could not be imported:</div>
                  <ul style={{ marginTop: 8, paddingLeft: 18, listStyle: "disc" }}>
                    {pasteErrors.map((err) => (
                      <li key={`${err.line}-${err.error}`} className="muted">
                        Line {err.line}: {err.error} — {err.raw}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-title">Create Invoice</div>
        <form onSubmit={handleSubmit} className="invoice-editor">
          <div className="invoice-header">
            <div className="invoice-card">
              <div className="invoice-tabs">
                <button
                  type="button"
                  className={activeTab === "billing" ? "active" : ""}
                  onClick={() => setActiveTab("billing")}
                >
                  Billing
                </button>
                <button
                  type="button"
                  className={activeTab === "shipping" ? "active" : ""}
                  onClick={() => setActiveTab("shipping")}
                >
                  Shipping
                </button>
              </div>
              {activeTab === "billing" ? (
                <div className="invoice-form-grid">
                  <label className="field">
                    Customer
                    <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                  </label>
                  <label className="field">
                    Customer phone
                    <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  </label>
                  <label className="field">
                    Customer TPIN
                    <input value={customerTpin} onChange={(e) => setCustomerTpin(e.target.value)} />
                  </label>
                  <label className="field" style={{ gridColumn: "1 / -1" }}>
                    Bill to
                    <textarea
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      rows={3}
                      placeholder="Enter billing address"
                    />
                  </label>
                </div>
              ) : (
                <div className="invoice-form-grid">
                  <label className="field" style={{ gridColumn: "1 / -1" }}>
                    Ship to
                    <textarea
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      rows={3}
                      placeholder="Enter shipping address"
                      disabled={sameAsBilling}
                    />
                  </label>
                  <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) => setSameAsBilling(e.target.checked)}
                    />
                    Same as billing
                  </label>
                  <label className="field">
                    Ship by
                    <input value={shipBy} onChange={(e) => setShipBy(e.target.value)} placeholder="Courier" />
                  </label>
                  <label className="field">
                    Tracking ref no.
                    <input
                      value={trackingRef}
                      onChange={(e) => setTrackingRef(e.target.value)}
                      placeholder="Tracking reference"
                    />
                  </label>
                  <label className="field">
                    Shipping cost
                    <input
                      value={shippingCost}
                      onChange={(e) => setShippingCost(Number(e.target.value))}
                      type="number"
                      min={0}
                    />
                  </label>
                  <label className="field">
                    Shipping tax %
                    <input
                      value={shippingTaxRate}
                      onChange={(e) => setShippingTaxRate(Number(e.target.value))}
                      type="number"
                      min={0}
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="invoice-card">
              <div className="invoice-pill">Invoice</div>
              <div className="invoice-form-grid">
                <label className="field">
                  Create From
                  <select defaultValue="new" disabled>
                    <option value="new">New Invoice</option>
                  </select>
                </label>
                <label className="field">
                  Project
                  <select
                    value={projectId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setProjectId(nextId);
                      const match = projects.find((proj) => proj._id === nextId);
                      setProjectLabel(match ? match.name : "");
                    }}
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Date
                  <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" required />
                </label>
                <label className="field">
                  Status
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="draft">draft</option>
                    <option value="sent">sent</option>
                    <option value="paid">paid</option>
                  </select>
                </label>
                <label className="field">
                  VAT rate %
                  <input
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                    type="number"
                    min={0}
                  />
                </label>
                <label className="field">
                  Invoice number
                  <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
                </label>
              </div>
            </div>
          </div>

          <div className="invoice-table-wrap">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Qty</th>
                  <th>Item / Description</th>
                  <th style={{ width: 140 }}>Unit Price</th>
                  <th style={{ width: 140 }}>Discount</th>
                  <th style={{ width: 140 }}>Total</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const lineTotal = Math.max(0, item.qty * item.unitPrice - (item.discount || 0));
                  return (
                    <tr key={index}>
                      <td>
                        <input
                          className="invoice-input"
                          value={item.qty}
                          onChange={(e) => updateItem(index, { qty: Number(e.target.value) })}
                          type="number"
                          min={0}
                        />
                      </td>
                      <td>
                        <input
                          className="invoice-input"
                          value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          placeholder="Item description"
                          required
                        />
                      </td>
                      <td>
                        <input
                          className="invoice-input"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
                          type="number"
                          min={0}
                        />
                      </td>
                      <td>
                        <input
                          className="invoice-input"
                          value={item.discount ?? 0}
                          onChange={(e) => updateItem(index, { discount: Number(e.target.value) })}
                          type="number"
                          min={0}
                        />
                      </td>
                      <td className="invoice-total">{lineTotal.toFixed(2)}</td>
                      <td>
                        {items.length > 1 ? (
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => removeItem(index)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="invoice-footer">
            <div className="invoice-actions">
              <button className="button secondary" type="button" onClick={addItem}>
                Add item
              </button>
            </div>
            <div className="invoice-summary">
              <div>
                <span>Subtotal</span>
                <strong>{itemsSubtotal.toFixed(2)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>{shippingValue.toFixed(2)}</strong>
              </div>
              <div>
                <span>VAT</span>
                <strong>{vatAmount.toFixed(2)}</strong>
              </div>
              <div className="invoice-summary-total">
                <span>Total</span>
                <strong>{total.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create invoice"}
            </button>
            <button className="button secondary" type="button" onClick={() => router.push("/invoices")}>
              Cancel
            </button>
          </div>

          {error ? <div className="muted">{error}</div> : null}
        </form>
      </section>
    </>
  );
}
