"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";
import BarcodeCamera from "@/components/BarcodeCamera";

type Product = {
  _id: string;
  name: string;
  sku?: string;
  barcode?: string;
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

export default function InventoryNewProductClient({ barcode }: { barcode: string }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductFormState>(createProductForm());
  const [barcodeScan, setBarcodeScan] = useState("");
  const [useCamera, setUseCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanOverlayStatus, setScanOverlayStatus] = useState("");
  const [scanOverlayTone, setScanOverlayTone] = useState<"neutral" | "success" | "error">("neutral");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cameraBusyRef = useRef(false);
  const cameraCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => setWorkspace(buildWorkspace(data.company)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!workspace?.inventoryEnabled) return;
    apiFetch<{ products: Product[] }>("/api/products")
      .then((data) => setProducts(data.products || []))
      .catch(() => {});
  }, [workspace]);

  useEffect(() => {
    if (barcode) {
      setForm((prev) => ({ ...prev, barcode }));
    }
  }, [barcode]);

  useEffect(() => {
    if (!useCamera) return;
    setCameraError("");
  }, [useCamera]);

  useEffect(() => {
    return () => {
      if (cameraCloseRef.current) clearTimeout(cameraCloseRef.current);
    };
  }, []);

  const resetScannerState = () => {
    if (cameraCloseRef.current) clearTimeout(cameraCloseRef.current);
    cameraBusyRef.current = false;
    setUseCamera(false);
    setScanOverlayStatus("");
    setScanOverlayTone("neutral");
    setCameraError("");
    setBarcodeScan("");
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        category: form.category || undefined,
        unit: form.unit || undefined,
        costPrice: Number(form.costPrice) || 0,
        salePrice: Number(form.salePrice) || 0,
        reorderLevel: Number(form.reorderLevel) || 0
      };
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      resetScannerState();
      router.push("/inventory");
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  if (workspace && !workspace.inventoryEnabled) {
    return (
      <section className="panel">
        <div className="panel-title">Add product</div>
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
          <div className="panel-title">Add product</div>
          <button className="button ghost" type="button" onClick={() => router.push("/inventory")}>
            Back to inventory
          </button>
        </div>
        {error ? <div className="muted" style={{ marginBottom: 12 }}>{error}</div> : null}
        <form onSubmit={saveProduct} className="grid-two">
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
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Saving..." : "Add product"}
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
