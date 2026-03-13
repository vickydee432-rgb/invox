"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Branch = {
  _id: string;
  name: string;
  isDefault?: boolean;
  isActive?: boolean;
};

type Product = {
  _id: string;
  name: string;
  sku?: string;
  isActive?: boolean;
};

type StockRow = {
  productId?: string;
  branchId?: string;
  onHand?: number;
  product?: Product;
  branch?: Branch;
};

const reasons = ["Adjustment", "Inventory Count", "Correction", "Damage", "Return"];

export default function InventoryEditStockClient({
  productId: initialProductId,
  branchId: initialBranchId,
  onHand: initialOnHand
}: {
  productId: string;
  branchId: string;
  onHand: string;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branchId, setBranchId] = useState(initialBranchId);
  const [productId, setProductId] = useState(initialProductId);
  const [currentOnHand, setCurrentOnHand] = useState(
    Number.isFinite(Number(initialOnHand)) ? Number(initialOnHand) : 0
  );
  const [newOnHand, setNewOnHand] = useState(
    Number.isFinite(Number(initialOnHand)) ? Number(initialOnHand) : 0
  );
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => setWorkspace(buildWorkspace(data.company)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!workspace?.inventoryEnabled) return;
    const loadAll = async () => {
      try {
        const [branchesData, productsData] = await Promise.all([
          apiFetch<{ branches: Branch[] }>("/api/branches"),
          apiFetch<{ products: Product[] }>("/api/products")
        ]);
        const activeBranches = (branchesData.branches || []).filter((b) => b.isActive !== false);
        const activeProducts = (productsData.products || []).filter((p) => p.isActive !== false);
        setBranches(activeBranches);
        setProducts(activeProducts);
        if (!branchId) {
          const def = activeBranches.find((b) => b.isDefault);
          if (def) setBranchId(def._id);
          else if (activeBranches[0]) setBranchId(activeBranches[0]._id);
        }
        if (!productId && activeProducts[0]) setProductId(activeProducts[0]._id);
      } catch (err: any) {
        setError(err.message || "Failed to load stock data");
      }
    };
    loadAll();
  }, [workspace, branchId, productId]);

  useEffect(() => {
    const loadCurrent = async () => {
      if (!branchId || !productId) return;
      try {
        const data = await apiFetch<{ stock: StockRow[] }>(`/api/stock?branchId=${branchId}`);
        const row = (data.stock || []).find(
          (item) => String(item.productId || item.product?._id) === String(productId)
        );
        const nextOnHand = Number(row?.onHand || 0);
        setCurrentOnHand(nextOnHand);
        setNewOnHand(nextOnHand);
      } catch (err: any) {
        setError(err.message || "Failed to load stock level");
      }
    };
    loadCurrent();
  }, [branchId, productId]);

  const productOptions = useMemo(() => products, [products]);
  const branchOptions = useMemo(() => branches, [branches]);

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!productId) {
      setError("Select a product first.");
      return;
    }
    if (!branchId) {
      setError("Select a branch first.");
      return;
    }
    const target = Number(newOnHand);
    if (!Number.isFinite(target)) {
      setError("Enter a valid quantity.");
      return;
    }
    const change = target - Number(currentOnHand || 0);
    if (change === 0) {
      setError("No change to save.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          productId,
          change,
          reason,
          note: note || undefined,
          branchId
        })
      });
      router.push("/inventory");
    } catch (err: any) {
      setError(err.message || "Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  if (workspace && !workspace.inventoryEnabled) {
    return (
      <section className="panel">
        <div className="panel-title">Edit stock</div>
        <div className="muted">Inventory is disabled for this workspace.</div>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <div
          className="action-row"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
        >
          <div className="panel-title">Edit stock</div>
          <button className="button ghost" type="button" onClick={() => router.push("/inventory")}>
            Back to inventory
          </button>
        </div>
        {error ? <div className="muted" style={{ marginBottom: 12 }}>{error}</div> : null}
        <form onSubmit={saveEdit} className="grid-two">
          <label className="field">
            Product
            <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
              {productOptions.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                  {product.sku ? ` (${product.sku})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Branch
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
              {branchOptions.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Current on hand
            <input value={Number(currentOnHand || 0)} disabled />
          </label>
          <label className="field">
            New on hand
            <input
              type="number"
              value={newOnHand}
              onChange={(e) => setNewOnHand(Number(e.target.value))}
              required
            />
          </label>
          <label className="field">
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            Note
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </label>
          <div className="field">
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button className="button secondary" type="button" onClick={() => router.push("/inventory")}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
