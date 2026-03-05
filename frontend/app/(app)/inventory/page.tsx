"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";
import BarcodeCamera from "@/components/BarcodeCamera";

type Branch = {
  _id: string;
  name: string;
  code?: string;
  address?: string;
  isDefault?: boolean;
  isActive?: boolean;
};

type Product = {
  _id: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  category?: string;
  unit?: string;
  costPrice?: number;
  salePrice?: number;
  reorderLevel?: number;
  isActive?: boolean;
};

type StockRow = {
  _id: string;
  onHand: number;
  avgCost: number;
  lowStock?: boolean;
  product?: Product;
  branch?: Branch;
};

export default function InventoryPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);

  const [branchForm, setBranchForm] = useState({
    id: "",
    name: "",
    code: "",
    address: "",
    isDefault: false
  });
  const [productForm, setProductForm] = useState({
    id: "",
    name: "",
    sku: "",
    barcode: "",
    category: "",
    unit: "",
    costPrice: 0,
    salePrice: 0,
    reorderLevel: 0
  });
  const [barcodeScan, setBarcodeScan] = useState("");
  const [stockBranchId, setStockBranchId] = useState("");
  const [useCamera, setUseCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanOverlayStatus, setScanOverlayStatus] = useState("");
  const [scanOverlayTone, setScanOverlayTone] = useState<"neutral" | "success" | "error">("neutral");
  const cameraBusyRef = useRef(false);
  const cameraCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cameraCloseRef.current) clearTimeout(cameraCloseRef.current);
    };
  }, []);

  const activeBranches = useMemo(() => branches.filter((b) => b.isActive !== false), [branches]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const barcode = params.get("barcode");
    if (barcode) {
      setProductForm((prev) => ({ ...prev, id: "", barcode }));
    }
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [branchesData, productsData] = await Promise.all([
        apiFetch<{ branches: Branch[] }>("/api/branches"),
        apiFetch<{ products: Product[] }>("/api/products")
      ]);
      setBranches(branchesData.branches || []);
      setProducts(productsData.products || []);
    } catch (err: any) {
      setError(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const loadStock = async (branchId?: string) => {
    try {
      const params = branchId ? `?branchId=${branchId}` : "";
      const data = await apiFetch<{ stock: StockRow[] }>(`/api/stock${params}`);
      setStock(data.stock || []);
    } catch (err: any) {
      setError(err.message || "Failed to load stock");
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
    if (workspace && !workspace.inventoryEnabled) {
      setLoading(false);
      return;
    }
    loadAll();
  }, [workspace]);

  useEffect(() => {
    if (workspace && !workspace.inventoryEnabled) return;
    loadStock(stockBranchId || undefined);
  }, [stockBranchId, workspace]);

  if (workspace && !workspace.inventoryEnabled) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.inventory || "Inventory"}</div>
        <div className="muted">Inventory is disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  const resetBranchForm = () =>
    setBranchForm({
      id: "",
      name: "",
      code: "",
      address: "",
      isDefault: false
    });

  const resetProductForm = () =>
    setProductForm({
      id: "",
      name: "",
      sku: "",
      barcode: "",
      category: "",
      unit: "",
      costPrice: 0,
      salePrice: 0,
      reorderLevel: 0
    });

  const saveBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (branchForm.id) {
        await apiFetch(`/api/branches/${branchForm.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: branchForm.name,
            code: branchForm.code || undefined,
            address: branchForm.address || undefined,
            isDefault: branchForm.isDefault
          })
        });
      } else {
        await apiFetch("/api/branches", {
          method: "POST",
          body: JSON.stringify({
            name: branchForm.name,
            code: branchForm.code || undefined,
            address: branchForm.address || undefined,
            isDefault: branchForm.isDefault
          })
        });
      }
      resetBranchForm();
      await loadAll();
      await loadStock(stockBranchId || undefined);
    } catch (err: any) {
      setError(err.message || "Failed to save branch");
    }
  };

  const editBranch = (branch: Branch) => {
    setBranchForm({
      id: branch._id,
      name: branch.name || "",
      code: branch.code || "",
      address: branch.address || "",
      isDefault: Boolean(branch.isDefault)
    });
  };

  const removeBranch = async (branch: Branch) => {
    const ok = window.confirm(`Disable branch ${branch.name}?`);
    if (!ok) return;
    try {
      await apiFetch(`/api/branches/${branch._id}`, { method: "DELETE" });
      await loadAll();
      await loadStock(stockBranchId || undefined);
    } catch (err: any) {
      setError(err.message || "Failed to delete branch");
    }
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        name: productForm.name,
        sku: productForm.sku || undefined,
        barcode: productForm.barcode || undefined,
        category: productForm.category || undefined,
        unit: productForm.unit || undefined,
        costPrice: Number(productForm.costPrice) || 0,
        salePrice: Number(productForm.salePrice) || 0,
        reorderLevel: Number(productForm.reorderLevel) || 0
      };
      if (productForm.id) {
        await apiFetch(`/api/products/${productForm.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch("/api/products", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetProductForm();
      await loadAll();
      await loadStock(stockBranchId || undefined);
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    }
  };

  const editProduct = (product: Product) => {
    setProductForm({
      id: product._id,
      name: product.name || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      category: product.category || "",
      unit: product.unit || "",
      costPrice: Number(product.costPrice || 0),
      salePrice: Number(product.salePrice || 0),
      reorderLevel: Number(product.reorderLevel || 0)
    });
  };

  const removeProduct = async (product: Product) => {
    const ok = window.confirm(`Disable product ${product.name}?`);
    if (!ok) return;
    try {
      await apiFetch(`/api/products/${product._id}`, { method: "DELETE" });
      await loadAll();
      await loadStock(stockBranchId || undefined);
    } catch (err: any) {
      setError(err.message || "Failed to delete product");
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-title">Inventory Overview</div>
        <div className="muted">Manage branches, products, and stock per branch.</div>
      </section>

      {error ? (
        <div className="panel">
          <div className="muted">{error}</div>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-title">Branches</div>
        <form onSubmit={saveBranch} className="grid-two">
          <label className="field">
            Branch name
            <input
              value={branchForm.name}
              onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            Code
            <input
              value={branchForm.code}
              onChange={(e) => setBranchForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            Address
            <input
              value={branchForm.address}
              onChange={(e) => setBranchForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </label>
          <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={branchForm.isDefault}
              onChange={(e) => setBranchForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
            />
            Default branch
          </label>
          <div className="field">
            <button className="button" type="submit">
              {branchForm.id ? "Update branch" : "Add branch"}
            </button>
            {branchForm.id ? (
              <button className="button secondary" type="button" onClick={resetBranchForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Code</th>
                <th>Address</th>
                <th>Default</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {activeBranches.map((branch) => (
                <tr key={branch._id}>
                  <td>{branch.name}</td>
                  <td>{branch.code || "-"}</td>
                  <td>{branch.address || "-"}</td>
                  <td>{branch.isDefault ? "Yes" : "No"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="button secondary" onClick={() => editBranch(branch)} type="button">
                        Edit
                      </button>
                      <button className="button ghost" onClick={() => removeBranch(branch)} type="button">
                        Disable
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeBranches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No branches yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div className="panel-title">Products</div>
          <a className="button ghost" href="/inventory/scan">
            Scan inventory
          </a>
        </div>
        <form onSubmit={saveProduct} className="grid-two">
          <label className="field">
            Product name
            <input
              value={productForm.name}
              onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            SKU
            <input
              value={productForm.sku}
              onChange={(e) => setProductForm((prev) => ({ ...prev, sku: e.target.value }))}
            />
          </label>
          <label className="field">
            Barcode
            <input
              value={productForm.barcode}
              onChange={(e) => setProductForm((prev) => ({ ...prev, barcode: e.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            Scan barcode here
            <input
              value={barcodeScan}
              onChange={(e) => setBarcodeScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const code = barcodeScan.trim();
                  if (!code) return;
                  setProductForm((prev) => ({ ...prev, barcode: code }));
                  setBarcodeScan("");
                }
              }}
              placeholder="Focus and scan"
            />
          </label>
          <div className="field" style={{ alignSelf: "end" }}>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setCameraError("");
                setScanOverlayStatus("");
                setScanOverlayTone("neutral");
                cameraBusyRef.current = false;
                setUseCamera((prev) => !prev);
              }}
            >
              {useCamera ? "Stop camera" : "Use camera"}
            </button>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <BarcodeCamera
              active={useCamera}
              onScan={(value) => {
                if (cameraBusyRef.current) return;
                cameraBusyRef.current = true;
                setProductForm((prev) => ({ ...prev, barcode: value }));
                setBarcodeScan("");
                const matched = products.find((product) => product.barcode === value);
                if (matched) {
                  setScanOverlayStatus(`Found: ${matched.name}`);
                  setScanOverlayTone("success");
                } else {
                  setScanOverlayStatus(`Captured: ${value}`);
                  setScanOverlayTone("neutral");
                }
                if (cameraCloseRef.current) clearTimeout(cameraCloseRef.current);
                cameraCloseRef.current = setTimeout(() => {
                  setUseCamera(false);
                  setScanOverlayStatus("");
                  setScanOverlayTone("neutral");
                  cameraBusyRef.current = false;
                }, 800);
              }}
              onError={(message) => setCameraError(message)}
              mode="overlay"
              onClose={() => {
                if (cameraCloseRef.current) clearTimeout(cameraCloseRef.current);
                cameraBusyRef.current = false;
                setScanOverlayStatus("");
                setScanOverlayTone("neutral");
                setUseCamera(false);
              }}
              showLast={false}
              title="Scanning barcode..."
              subtitle="Align the barcode within the frame"
              status={scanOverlayStatus}
              statusTone={scanOverlayTone}
            />
            {cameraError ? <div className="muted" style={{ marginTop: 8 }}>{cameraError}</div> : null}
          </div>
          <label className="field">
            Category
            <input
              value={productForm.category}
              onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))}
            />
          </label>
          <label className="field">
            Unit
            <input
              value={productForm.unit}
              onChange={(e) => setProductForm((prev) => ({ ...prev, unit: e.target.value }))}
            />
          </label>
          <label className="field">
            Order price
            <input
              type="number"
              min={0}
              value={productForm.costPrice}
              onChange={(e) => setProductForm((prev) => ({ ...prev, costPrice: Number(e.target.value) }))}
            />
          </label>
          <label className="field">
            Sale price
            <input
              type="number"
              min={0}
              value={productForm.salePrice}
              onChange={(e) => setProductForm((prev) => ({ ...prev, salePrice: Number(e.target.value) }))}
            />
          </label>
          <label className="field">
            Reorder level
            <input
              type="number"
              min={0}
              value={productForm.reorderLevel}
              onChange={(e) => setProductForm((prev) => ({ ...prev, reorderLevel: Number(e.target.value) }))}
            />
          </label>
          <div className="field">
            <button className="button" type="submit">
              {productForm.id ? "Update product" : "Add product"}
            </button>
            {productForm.id ? (
              <button className="button secondary" type="button" onClick={resetProductForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Sale price</th>
                <th>Reorder</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.filter((product) => product.isActive !== false).map((product) => (
                <tr key={product._id}>
                  <td>{product.name}</td>
                  <td>{product.sku || "-"}</td>
                  <td>{product.category || "-"}</td>
                  <td>{Number(product.salePrice || 0).toFixed(2)}</td>
                  <td>{Number(product.reorderLevel || 0)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="button secondary" onClick={() => editProduct(product)} type="button">
                        Edit
                      </button>
                      <button className="button ghost" onClick={() => removeProduct(product)} type="button">
                        Disable
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No products yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="panel-title">Stock by Branch</div>
          <label className="field" style={{ minWidth: 220 }}>
            Branch filter
            <select value={stockBranchId} onChange={(e) => setStockBranchId(e.target.value)}>
              <option value="">All branches</option>
              {activeBranches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Product</th>
                <th>SKU</th>
                <th>On hand</th>
                <th>Avg cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((row) => (
                <tr key={row._id}>
                  <td>{row.branch?.name || "-"}</td>
                  <td>{row.product?.name || "-"}</td>
                  <td>{row.product?.sku || "-"}</td>
                  <td>{Number(row.onHand || 0)}</td>
                  <td>{Number(row.avgCost || 0).toFixed(2)}</td>
                  <td>{row.lowStock ? "Low" : "OK"}</td>
                </tr>
              ))}
              {stock.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No stock yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {loading ? <div className="muted">Loading inventory...</div> : null}
    </div>
  );
}
