"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

declare global {
  interface Window {
    Html5Qrcode?: any;
  }
}

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
  barcode?: string;
  costPrice?: number;
  salePrice?: number;
  unit?: string;
};

type ScanEntry = {
  barcode: string;
  timestamp: string;
  status: "found" | "not_found";
  productName?: string;
};

export default function InventoryScanPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState<Product | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanEntry[]>([]);
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustReason, setAdjustReason] = useState("Stock In");
  const [adjustNote, setAdjustNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    unit: "",
    costPrice: 0,
    salePrice: 0
  });
  const [useCamera, setUseCamera] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const qrRef = useRef<any>(null);
  const cameraReadyRef = useRef(false);

  const loadHtml5Qrcode = () =>
    new Promise<any>((resolve, reject) => {
      if (typeof window === "undefined") return reject(new Error("No window"));
      if (window.Html5Qrcode) return resolve(window.Html5Qrcode);

      const existing = document.getElementById("html5-qrcode-sdk");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.Html5Qrcode));
        existing.addEventListener("error", () => reject(new Error("Failed to load camera SDK")));
        return;
      }

      const script = document.createElement("script");
      script.id = "html5-qrcode-sdk";
      script.src = "https://unpkg.com/html5-qrcode@2.3.8/minified/html5-qrcode.min.js";
      script.async = true;
      script.onload = () => resolve(window.Html5Qrcode);
      script.onerror = () => reject(new Error("Failed to load camera SDK"));
      document.body.appendChild(script);
    });

  useEffect(() => {
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => setWorkspace(buildWorkspace(data.company)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!workspace?.inventoryEnabled) return;
    apiFetch<{ branches: Branch[] }>("/api/branches")
      .then((data) => {
        const active = (data.branches || []).filter((b) => b.isActive !== false);
        setBranches(active);
        const def = active.find((b) => b.isDefault);
        if (def) setBranchId(def._id);
        else if (active[0]) setBranchId(active[0]._id);
      })
      .catch(() => {});
  }, [workspace]);

  useEffect(() => {
    if (!useCamera) return;
    let mounted = true;
    const start = async () => {
      try {
        const Html5Qrcode = await loadHtml5Qrcode();
        if (!mounted || !Html5Qrcode) return;
        const instance = new Html5Qrcode("barcode-camera");
        qrRef.current = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (decodedText: string) => {
            handleScan(decodedText);
          }
        );
        cameraReadyRef.current = true;
      } catch (err) {
        setScanError("Camera scanning unavailable in this browser.");
      }
    };
    start();
    return () => {
      mounted = false;
      if (qrRef.current) {
        qrRef.current.stop().catch(() => undefined);
        qrRef.current.clear().catch(() => undefined);
        qrRef.current = null;
      }
      cameraReadyRef.current = false;
    };
  }, [useCamera]);

  const branchOptions = useMemo(() => branches, [branches]);

  const pushHistory = (entry: ScanEntry) => {
    setScanHistory((prev) => [entry, ...prev].slice(0, 10));
  };

  const handleScan = async (value?: string) => {
    const code = (value ?? scanValue).trim();
    if (!code) return;
    setLoading(true);
    setScanError("");
    setScanResult(null);
    setShowCreate(false);
    try {
      const data = await apiFetch<{ product: Product }>(`/api/products/lookup?barcode=${encodeURIComponent(code)}`);
      setScanResult(data.product);
      setCreateForm((prev) => ({ ...prev, barcode: code }));
      pushHistory({ barcode: code, timestamp: new Date().toLocaleTimeString(), status: "found", productName: data.product.name });
    } catch (err: any) {
      setScanError(err.message || "Product not found");
      setCreateForm({ name: "", sku: "", barcode: code, unit: "", costPrice: 0, salePrice: 0 });
      setShowCreate(true);
      pushHistory({ barcode: code, timestamp: new Date().toLocaleTimeString(), status: "not_found" });
    } finally {
      setScanValue("");
      setLoading(false);
      scanInputRef.current?.focus();
    }
  };

  const adjustStock = async (change: number) => {
    if (!scanResult) return;
    setLoading(true);
    setScanError("");
    try {
      await apiFetch("/api/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          productId: scanResult._id,
          change,
          reason: adjustReason,
          note: adjustNote || undefined,
          branchId: branchId || undefined
        })
      });
    } catch (err: any) {
      setScanError(err.message || "Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async () => {
    setLoading(true);
    setScanError("");
    try {
      const data = await apiFetch<{ product: Product }>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name,
          sku: createForm.sku || undefined,
          barcode: createForm.barcode || undefined,
          unit: createForm.unit || undefined,
          costPrice: Number(createForm.costPrice) || 0,
          salePrice: Number(createForm.salePrice) || 0
        })
      });
      setScanResult(data.product);
      setShowCreate(false);
    } catch (err: any) {
      setScanError(err.message || "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  if (workspace && !workspace.inventoryEnabled) {
    return (
      <section className="panel">
        <div className="panel-title">Inventory Scan</div>
        <div className="muted">Inventory is disabled for this workspace.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Inventory Scanner</div>
      <div className="muted">Scan a barcode to update stock quickly.</div>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label className="field">
          Branch
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branchOptions.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Scan barcode
          <input
            ref={scanInputRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleScan();
              }
            }}
            placeholder="Focus and scan"
          />
        </label>
        <button className="button secondary" type="button" onClick={() => handleScan()} disabled={loading}>
          {loading ? "Working..." : "Lookup"}
        </button>
        <button className="button ghost" type="button" onClick={() => setUseCamera((prev) => !prev)}>
          {useCamera ? "Stop camera" : "Use camera"}
        </button>
        {useCamera ? <div id="barcode-camera" style={{ width: 280 }} /> : null}
      </div>

      {scanError ? <div className="muted" style={{ marginTop: 12 }}>{scanError}</div> : null}

      {scanResult ? (
        <div className="panel-subtle" style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 600 }}>{scanResult.name}</div>
          <div className="muted">SKU: {scanResult.sku || "-"} · Barcode: {scanResult.barcode || "-"}</div>
          <div className="muted">Sale: {Number(scanResult.salePrice || 0).toFixed(2)}</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button className="button" type="button" onClick={() => adjustStock(1)}>+1</button>
            <button className="button" type="button" onClick={() => adjustStock(5)}>+5</button>
            <button className="button" type="button" onClick={() => adjustStock(10)}>+10</button>
            <button className="button ghost" type="button" onClick={() => adjustStock(-1)}>-1</button>
            <button className="button ghost" type="button" onClick={() => adjustStock(-5)}>-5</button>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 12, maxWidth: 240 }}>
            <label className="field">
              Custom qty
              <input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(Number(e.target.value))}
              />
            </label>
            <label className="field">
              Reason
              <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}>
                <option value="Stock In">Stock In</option>
                <option value="Stock Out">Stock Out</option>
                <option value="Correction">Correction</option>
              </select>
            </label>
            <label className="field">
              Note
              <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
            </label>
            <button className="button secondary" type="button" onClick={() => adjustStock(Number(adjustQty) || 0)}>
              Apply adjustment
            </button>
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <div className="panel-subtle" style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Create product</div>
          <div style={{ display: "grid", gap: 10, maxWidth: 320 }}>
            <label className="field">
              Name
              <input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label className="field">
              Barcode
              <input value={createForm.barcode} onChange={(e) => setCreateForm((p) => ({ ...p, barcode: e.target.value }))} />
            </label>
            <label className="field">
              SKU
              <input value={createForm.sku} onChange={(e) => setCreateForm((p) => ({ ...p, sku: e.target.value }))} />
            </label>
            <label className="field">
              Unit
              <input value={createForm.unit} onChange={(e) => setCreateForm((p) => ({ ...p, unit: e.target.value }))} />
            </label>
            <label className="field">
              Cost price
              <input type="number" value={createForm.costPrice} onChange={(e) => setCreateForm((p) => ({ ...p, costPrice: Number(e.target.value) }))} />
            </label>
            <label className="field">
              Sale price
              <input type="number" value={createForm.salePrice} onChange={(e) => setCreateForm((p) => ({ ...p, salePrice: Number(e.target.value) }))} />
            </label>
            <button className="button" type="button" onClick={createProduct} disabled={loading}>
              {loading ? "Creating..." : "Create product"}
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <div className="panel-title" style={{ fontSize: 14 }}>Last scans</div>
        <div style={{ display: "grid", gap: 8 }}>
          {scanHistory.map((entry, index) => (
            <div key={`${entry.barcode}-${index}`} className="panel-subtle">
              <strong>{entry.barcode}</strong> · {entry.status === "found" ? entry.productName : "Not found"}
              <div className="muted">{entry.timestamp}</div>
            </div>
          ))}
          {scanHistory.length === 0 ? <div className="muted">No scans yet.</div> : null}
        </div>
      </div>
    </section>
  );
}
