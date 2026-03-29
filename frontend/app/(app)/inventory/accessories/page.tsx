"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Product = {
  _id: string;
  name: string;
  itemType?: "general" | "accessory" | "part";
  sku?: string;
  barcode?: string;
  category?: string;
  unit?: string;
  costPrice?: number;
  salePrice?: number;
  reorderLevel?: number;
  isActive?: boolean;
};

const formatMoney = (value: number) => Number(value || 0).toFixed(2);

export default function AccessoriesInventoryPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"accessory" | "part" | "">("");

  const [form, setForm] = useState({
    name: "",
    itemType: "accessory",
    sku: "",
    barcode: "",
    category: "",
    unit: "",
    costPrice: 0,
    salePrice: 0,
    reorderLevel: 0
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = typeFilter ? products.filter((p) => p.itemType === typeFilter) : products;
    if (!term) return list;
    return list.filter((p) => {
      return (
        String(p.name || "").toLowerCase().includes(term) ||
        String(p.sku || "").toLowerCase().includes(term) ||
        String(p.barcode || "").toLowerCase().includes(term)
      );
    });
  }, [products, q, typeFilter]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ products: Product[] }>("/api/products?itemType=accessory,part");
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message || "Failed to load accessories/parts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
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

  const resetForm = () => {
    setForm({
      name: "",
      itemType: "accessory",
      sku: "",
      barcode: "",
      category: "",
      unit: "",
      costPrice: 0,
      salePrice: 0,
      reorderLevel: 0
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          itemType: form.itemType,
          sku: form.sku || undefined,
          barcode: form.barcode || undefined,
          category: form.category || undefined,
          unit: form.unit || undefined,
          costPrice: Number(form.costPrice) || 0,
          salePrice: Number(form.salePrice) || 0,
          reorderLevel: Number(form.reorderLevel) || 0
        })
      });
      resetForm();
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to create item");
    } finally {
      setSaving(false);
    }
  };

  const patchProduct = async (product: Product, next: Partial<Product>) => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/products/${product._id}`, { method: "PATCH", body: JSON.stringify(next) });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"?`)) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/products/${product._id}`, { method: "DELETE" });
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to delete item");
    } finally {
      setSaving(false);
    }
  };

  if (workspace && !workspace.inventoryEnabled) {
    return (
      <section className="panel">
        <div className="panel-title">Accessories & Parts</div>
        <div className="muted">Inventory is disabled for this workspace.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Accessories & parts inventory</div>
      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={handleCreate} style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <div className="grid-3">
          <label className="field">
            Type
            <select value={form.itemType} onChange={(e) => setForm((p) => ({ ...p, itemType: e.target.value }))}>
              <option value="accessory">Accessory</option>
              <option value="part">Part</option>
            </select>
          </label>
          <label className="field">
            Name
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          </label>
          <label className="field">
            SKU
            <input value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
          </label>
        </div>
        <div className="grid-4">
          <label className="field">
            Barcode
            <input value={form.barcode} onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))} />
          </label>
          <label className="field">
            Unit
            <input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} placeholder="pcs" />
          </label>
          <label className="field">
            Cost price
            <input type="number" min={0} value={form.costPrice} onChange={(e) => setForm((p) => ({ ...p, costPrice: Number(e.target.value) }))} />
          </label>
          <label className="field">
            Sale price
            <input type="number" min={0} value={form.salePrice} onChange={(e) => setForm((p) => ({ ...p, salePrice: Number(e.target.value) }))} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" type="submit" disabled={saving || !form.name.trim()}>
            {saving ? "Saving..." : "Add item"}
          </button>
          <button className="button secondary" type="button" onClick={resetForm} disabled={saving}>
            Clear
          </button>
        </div>
      </form>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
          <option value="">All</option>
          <option value="accessory">Accessories</option>
          <option value="part">Parts</option>
        </select>
        <button className="button secondary" type="button" onClick={loadAll} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="muted">No items found.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>SKU</th>
                <th>Cost</th>
                <th>Sale</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {p.barcode ? `Barcode: ${p.barcode}` : ""}
                    </div>
                  </td>
                  <td>
                    <select
                      value={p.itemType || "general"}
                      onChange={(e) => patchProduct(p, { itemType: e.target.value as any })}
                      disabled={saving}
                    >
                      <option value="accessory">Accessory</option>
                      <option value="part">Part</option>
                      <option value="general">General</option>
                    </select>
                  </td>
                  <td>{p.sku || "—"}</td>
                  <td>{formatMoney(p.costPrice || 0)}</td>
                  <td>{formatMoney(p.salePrice || 0)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="button danger" type="button" onClick={() => deleteProduct(p)} disabled={saving}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

