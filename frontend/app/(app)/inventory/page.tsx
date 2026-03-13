"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
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

type ProductFormState = {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  reorderLevel: number;
};

type EditProductFormState = ProductFormState & { id: string };

type StockRow = {
  _id: string;
  onHand: number;
  avgCost: number;
  lowStock?: boolean;
  product?: Product;
  branch?: Branch;
};

const formatMoney = (value: number) => Number(value || 0).toFixed(2);

export default function InventoryPage() {
  const createProductForm = (): ProductFormState => ({
    name: "",
    sku: "",
    barcode: "",
    category: "",
    unit: "",
    costPrice: 0,
    salePrice: 0,
    reorderLevel: 0
  });
  const createEditProductForm = (): EditProductFormState => ({
    id: "",
    ...createProductForm()
  });

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
  const [productForm, setProductForm] = useState<ProductFormState>(createProductForm());
  const [editProductForm, setEditProductForm] = useState<EditProductFormState>(createEditProductForm());
  const [showAddProductForm, setShowAddProductForm] = useState(false);
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
      setEditProductForm(createEditProductForm());
      setShowAddProductForm(true);
      setProductForm((prev) => ({ ...prev, barcode }));
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

  const resetProductForm = () => setProductForm(createProductForm());

  const resetEditProductForm = () => setEditProductForm(createEditProductForm());

  const resetScannerState = () => {
    if (cameraCloseRef.current) clearTimeout(cameraCloseRef.current);
    cameraBusyRef.current = false;
    setUseCamera(false);
    setScanOverlayStatus("");
    setScanOverlayTone("neutral");
    setCameraError("");
    setBarcodeScan("");
  };

  const closeAddProductForm = () => {
    setShowAddProductForm(false);
    resetProductForm();
    resetScannerState();
  };

  const closeEditProductForm = () => {
    resetEditProductForm();
    resetScannerState();
  };

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
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      closeAddProductForm();
      await loadAll();
      await loadStock(stockBranchId || undefined);
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    }
  };

  const updateProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!editProductForm.id) return;
    try {
      const payload = {
        name: editProductForm.name,
        sku: editProductForm.sku || undefined,
        barcode: editProductForm.barcode || undefined,
        category: editProductForm.category || undefined,
        unit: editProductForm.unit || undefined,
        costPrice: Number(editProductForm.costPrice) || 0,
        salePrice: Number(editProductForm.salePrice) || 0,
        reorderLevel: Number(editProductForm.reorderLevel) || 0
      };
      await apiFetch(`/api/products/${editProductForm.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      closeEditProductForm();
      await loadAll();
      await loadStock(stockBranchId || undefined);
    } catch (err: any) {
      setError(err.message || "Failed to update product");
    }
  };

  const editProduct = (product: Product) => {
    setShowAddProductForm(false);
    resetScannerState();
    setEditProductForm({
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

  const renderBranchActions = (branch: Branch) => (
    <>
      <button className="button secondary" onClick={() => editBranch(branch)} type="button">
        Edit
      </button>
      <button className="button ghost" onClick={() => removeBranch(branch)} type="button">
        Disable
      </button>
    </>
  );

  const renderProductActions = (product: Product) => (
    <>
      <button className="button secondary" onClick={() => editProduct(product)} type="button">
        Edit
      </button>
      <button className="button ghost" onClick={() => removeProduct(product)} type="button">
        Disable
      </button>
    </>
  );

  const renderProductForm = <T extends ProductFormState>({
    form,
    setForm,
    onSubmit,
    submitLabel,
    cancelLabel,
    onCancel
  }: {
    form: T;
    setForm: Dispatch<SetStateAction<T>>;
    onSubmit: (event: React.FormEvent) => void | Promise<void>;
    submitLabel: string;
    cancelLabel: string;
    onCancel: () => void;
  }) => (
    <form onSubmit={onSubmit} className="grid-two">
      <label className="field">
        Product name
        <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
      </label>
      <label className="field">
        Stockcode / SKU
        <input value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} />
      </label>
      <label className="field">
        Barcode
        <input
          value={form.barcode}
          onChange={(e) => setForm((prev) => ({ ...prev, barcode: e.target.value }))}
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
              setForm((prev) => ({ ...prev, barcode: code }));
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
            setForm((prev) => ({ ...prev, barcode: value }));
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
        <input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} />
      </label>
      <label className="field">
        Unit
        <input value={form.unit} onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))} />
      </label>
      <label className="field">
        Order price
        <input
          type="number"
          min={0}
          value={form.costPrice}
          onChange={(e) => setForm((prev) => ({ ...prev, costPrice: Number(e.target.value) }))}
        />
      </label>
      <label className="field">
        Sale price
        <input
          type="number"
          min={0}
          value={form.salePrice}
          onChange={(e) => setForm((prev) => ({ ...prev, salePrice: Number(e.target.value) }))}
        />
      </label>
      <label className="field">
        Reorder level
        <input
          type="number"
          min={0}
          value={form.reorderLevel}
          onChange={(e) => setForm((prev) => ({ ...prev, reorderLevel: Number(e.target.value) }))}
        />
      </label>
      <div className="field">
        <button className="button" type="submit">
          {submitLabel}
        </button>
        <button className="button secondary" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </form>
  );

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
          <table className="table desktop-table">
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
                    <div className="mobile-inline-actions">{renderBranchActions(branch)}</div>
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
        <div className="mobile-record-list">
          {activeBranches.map((branch) => (
            <article key={branch._id} className="mobile-record-card">
              <div className="mobile-record-header">
                <div>
                  <div className="mobile-record-title">{branch.name}</div>
                  <div className="mobile-record-subtitle">{branch.code || "No code"}</div>
                </div>
                <span className="badge">{branch.isDefault ? "default" : "branch"}</span>
              </div>
              <div className="mobile-record-grid">
                <div className="mobile-record-item">
                  <span className="mobile-record-label">Address</span>
                  <span>{branch.address || "-"}</span>
                </div>
                <div className="mobile-record-item">
                  <span className="mobile-record-label">Default</span>
                  <span>{branch.isDefault ? "Yes" : "No"}</span>
                </div>
              </div>
              <div className="mobile-record-actions">{renderBranchActions(branch)}</div>
            </article>
          ))}
          {activeBranches.length === 0 ? <div className="muted">No branches yet.</div> : null}
        </div>
      </section>

      <section className="panel">
        <div
          className="action-row"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
        >
          <div className="panel-title">Products</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="button"
              type="button"
              onClick={() => {
                if (showAddProductForm) {
                  closeAddProductForm();
                  return;
                }
                closeEditProductForm();
                resetProductForm();
                setShowAddProductForm(true);
              }}
            >
              {showAddProductForm ? "Close add form" : "Add product"}
            </button>
            <a className="button ghost" href="/inventory/scan">
              Scan inventory
            </a>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table desktop-table">
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
                  <td>{formatMoney(product.salePrice || 0)}</td>
                  <td>{Number(product.reorderLevel || 0)}</td>
                  <td>
                    <div className="mobile-inline-actions">{renderProductActions(product)}</div>
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
        <div className="mobile-record-list">
          {products.filter((product) => product.isActive !== false).map((product) => (
            <article key={product._id} className="mobile-record-card">
              <div className="mobile-record-header">
                <div>
                  <div className="mobile-record-title">{product.name}</div>
                  <div className="mobile-record-subtitle">{product.sku || "No SKU"}</div>
                </div>
                <span className="badge">{product.category || "uncategorized"}</span>
              </div>
              <div className="mobile-record-grid">
                <div className="mobile-record-item">
                  <span className="mobile-record-label">Sale price</span>
                  <span>{formatMoney(product.salePrice || 0)}</span>
                </div>
                <div className="mobile-record-item">
                  <span className="mobile-record-label">Reorder</span>
                  <span>{Number(product.reorderLevel || 0)}</span>
                </div>
                <div className="mobile-record-item">
                  <span className="mobile-record-label">Barcode</span>
                  <span>{product.barcode || "-"}</span>
                </div>
              </div>
              <div className="mobile-record-actions">{renderProductActions(product)}</div>
            </article>
          ))}
          {products.filter((product) => product.isActive !== false).length === 0 ? (
            <div className="muted">No products yet.</div>
          ) : null}
        </div>
      </section>

      {showAddProductForm ? (
        <section className="panel">
          <div className="panel-title">Add product</div>
          {renderProductForm({
            form: productForm,
            setForm: setProductForm,
            onSubmit: saveProduct,
            submitLabel: "Add product",
            cancelLabel: "Close",
            onCancel: closeAddProductForm
          })}
        </section>
      ) : null}

      {editProductForm.id ? (
        <section className="panel">
          <div className="panel-title">Edit product</div>
          {renderProductForm({
            form: editProductForm,
            setForm: setEditProductForm,
            onSubmit: updateProduct,
            submitLabel: "Update product",
            cancelLabel: "Cancel edit",
            onCancel: closeEditProductForm
          })}
        </section>
      ) : null}

      <section className="panel">
        <div className="action-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
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
          <table className="table desktop-table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Product</th>
                <th>stockcode/SKU</th>
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
                  <td>{formatMoney(row.avgCost || 0)}</td>
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
        <div className="mobile-record-list">
          {stock.map((row) => (
            <article key={row._id} className="mobile-record-card">
              <div className="mobile-record-header">
                <div>
                  <div className="mobile-record-title">{row.product?.name || "-"}</div>
                  <div className="mobile-record-subtitle">{row.branch?.name || "-"}</div>
                </div>
                <span className="badge">{row.lowStock ? "low" : "ok"}</span>
              </div>
              <div className="mobile-record-grid">
                <div className="mobile-record-item">
                  <span className="mobile-record-label">SKU</span>
                  <span>{row.product?.sku || "-"}</span>
                </div>
                <div className="mobile-record-item">
                  <span className="mobile-record-label">On hand</span>
                  <span>{Number(row.onHand || 0)}</span>
                </div>
                <div className="mobile-record-item">
                  <span className="mobile-record-label">Avg cost</span>
                  <span>{formatMoney(row.avgCost || 0)}</span>
                </div>
              </div>
            </article>
          ))}
          {stock.length === 0 ? <div className="muted">No stock yet.</div> : null}
        </div>
      </section>

      {loading ? <div className="muted">Loading inventory...</div> : null}
    </div>
  );
}
