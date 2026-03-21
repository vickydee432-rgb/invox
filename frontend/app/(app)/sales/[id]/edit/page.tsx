"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type SaleItem = {
  productId?: string;
  productSku?: string;
  productName?: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
};

type Branch = {
  _id: string;
  name: string;
  isDefault?: boolean;
};

type Product = {
  _id: string;
  name: string;
  sku?: string;
  salePrice?: number;
};

type Sale = {
  _id: string;
  customerName?: string;
  customerPhone?: string;
  status: string;
  amountPaid: number;
  issueDate: string;
  vatRate: number;
  branchId?: string | null;
  items: SaleItem[];
};

const toDateInputValue = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function EditSalePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in");
  const [customerPhone, setCustomerPhone] = useState("");
  const [status, setStatus] = useState("paid");
  const [amountPaid, setAmountPaid] = useState(0);
  const [issueDate, setIssueDate] = useState("");
  const [vatRate, setVatRate] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<SaleItem[]>([{ description: "", qty: 1, unitPrice: 0, discount: 0 }]);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

  const itemsSubtotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.qty * item.unitPrice - (item.discount || 0)),
    0
  );
  const vatAmount = (itemsSubtotal * (Number(vatRate) || 0)) / 100;
  const total = itemsSubtotal + vatAmount;

  useEffect(() => {
    if (status === "paid") {
      setAmountPaid(total);
    }
  }, [status, total]);

  useEffect(() => {
    let mounted = true;
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => {
        if (!mounted) return;
        const config = buildWorkspace(data.company);
        setWorkspace(config);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (workspace && !workspace.inventoryEnabled) {
      setBranches([]);
      setProducts([]);
      return () => {
        mounted = false;
      };
    }
    Promise.all([
      apiFetch<{ branches: Branch[] }>("/api/branches"),
      apiFetch<{ products: Product[] }>("/api/products")
    ])
      .then(([branchData, productData]) => {
        if (!mounted) return;
        setBranches(branchData.branches || []);
        setProducts(productData.products || []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [workspace]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (!id || id === "undefined") {
      setError("Invalid sale id");
      setLoading(false);
      return () => {
        active = false;
      };
    }
    apiFetch<{ sale: Sale }>(`/api/sales/${id}`)
      .then((data) => {
        if (!active) return;
        const sale = data.sale;
        setCustomerName(sale.customerName || "Walk-in");
        setCustomerPhone(sale.customerPhone || "");
        setStatus(sale.status || "paid");
        setAmountPaid(sale.amountPaid || 0);
        setIssueDate(toDateInputValue(sale.issueDate));
        setVatRate(sale.vatRate ?? 0);
        setBranchId(sale.branchId || "");
        setItems(
          (sale.items || []).map((item) => ({
            productId: item.productId,
            productSku: item.productSku,
            productName: item.productName,
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount ?? 0
          }))
        );
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err.message || "Failed to load sale");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const updateItem = (index: number, next: Partial<SaleItem>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...next } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, discount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!id || id === "undefined") throw new Error("Invalid sale id");
      await apiFetch(`/api/sales/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          customerName,
          customerPhone: customerPhone || undefined,
          status,
          amountPaid,
          issueDate,
          vatRate: workspace?.taxEnabled === false ? 0 : vatRate,
          branchId: branchId || undefined,
          items: items.map((item) => ({
            productId: item.productId || undefined,
            productSku: item.productSku || undefined,
            productName: item.productName || undefined,
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount || 0
          }))
        })
      });
      router.push("/sales");
    } catch (err: any) {
      setError(err.message || "Failed to update sale");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm("Delete this sale? This cannot be undone.");
    if (!ok) return;
    try {
      await apiFetch(`/api/sales/${id}`, { method: "DELETE" });
      router.push("/sales");
    } catch (err: any) {
      setError(err.message || "Failed to delete sale");
    }
  };

  if (loading) {
    return (
      <section className="panel">
        <div className="panel-title">Edit Sale</div>
        <div className="muted">Loading sale...</div>
      </section>
    );
  }

  if (workspace && !workspace.enabledModules.includes("sales")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.sales || "Sales"}</div>
        <div className="muted">Sales are disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => router.push("/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Edit Sale</div>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div className="grid-2">
          <label className="field">
            Customer name
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <label className="field">
            Customer phone
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </label>
          <label className="field">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="field">
            Amount paid
            <input
              value={amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              type="number"
              min={0}
            />
          </label>
          <label className="field">
            Date
            <input value={issueDate} onChange={(e) => setIssueDate(e.target.value)} type="date" required />
          </label>
          {workspace?.taxEnabled !== false ? (
            <label className="field">
              VAT rate %
              <input value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} type="number" min={0} />
            </label>
          ) : null}
          {workspace?.inventoryEnabled ? (
            <label className="field">
              Branch
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item, index) => (
            <div key={index} className="grid-2">
              <label className="field">
                Product
                <select
                  value={item.productId || ""}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    if (!nextId) {
                      updateItem(index, {
                        productId: undefined,
                        productSku: undefined,
                        productName: undefined
                      });
                      return;
                    }
                    const product = products.find((p) => p._id === nextId);
                    updateItem(index, {
                      productId: nextId,
                      productSku: product?.sku,
                      productName: product?.name,
                      description: product?.name || item.description,
                      unitPrice: Number(product?.salePrice || 0)
                    });
                  }}
                >
                  <option value="">Custom item</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name}
                      {product.sku ? ` (${product.sku})` : ""}
                    </option>
                  ))}
                </select>
              </label>
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
                  value={item.discount || 0}
                  onChange={(e) => updateItem(index, { discount: Number(e.target.value) })}
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
            Add item
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="badge">Total {total.toFixed(2)}</div>
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Update sale"}
          </button>
          <button className="button secondary" type="button" onClick={() => router.push("/sales")}>
            Cancel
          </button>
          <button className="button secondary" type="button" onClick={handleDelete}>
            Delete
          </button>
          {error ? <div className="muted">{error}</div> : null}
        </div>
      </form>
    </section>
  );
}
