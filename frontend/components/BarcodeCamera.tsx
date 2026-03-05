"use client";

import { useEffect, useId, useRef, useState } from "react";

type BarcodeCameraProps = {
  active: boolean;
  onScan: (value: string) => void;
  onError?: (message: string) => void;
  width?: number;
  fps?: number;
  showLast?: boolean;
  mode?: "inline" | "overlay";
  onClose?: () => void;
  title?: string;
  subtitle?: string;
};

const loadHtml5Qrcode = async () => {
  if (typeof window === "undefined") throw new Error("No window");
  const mod: any = await import("html5-qrcode");
  return mod?.Html5Qrcode || mod?.default?.Html5Qrcode || mod?.default || mod;
};

const pickCameraId = (cameras: { id: string; label: string }[]) => {
  if (!cameras.length) return null;
  const preferred = cameras.find((camera) => /back|rear|environment/i.test(camera.label || ""));
  return (preferred || cameras[0])?.id || null;
};

export default function BarcodeCamera({
  active,
  onScan,
  onError,
  width = 280,
  fps = 10,
  showLast = true,
  mode = "inline",
  onClose,
  title = "Scanning barcode...",
  subtitle = "Align the barcode within the frame"
}: BarcodeCameraProps) {
  const elementId = useId();
  const qrRef = useRef<any>(null);
  const lastScanRef = useRef<{ value: string; ts: number } | null>(null);
  const [lastValue, setLastValue] = useState("");

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    const start = async () => {
      try {
        const Html5Qrcode = await loadHtml5Qrcode();
        if (!mounted || !Html5Qrcode) return;
        const cameras = (await Html5Qrcode.getCameras?.()) || [];
        const cameraId = pickCameraId(cameras);
        if (!cameraId) {
          onError?.("No camera detected.");
          return;
        }
        const instance = new Html5Qrcode(elementId);
        qrRef.current = instance;
        const qrbox =
          mode === "overlay"
            ? (viewfinderWidth: number, viewfinderHeight: number) => ({
                width: Math.min(viewfinderWidth * 0.78, 380),
                height: Math.min(viewfinderHeight * 0.24, 180)
              })
            : 220;
        await instance.start(
          cameraId,
          { fps, qrbox },
          (decodedText: string) => {
            const value = String(decodedText || "").trim();
            if (!value) return;
            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.value === value && now - last.ts < 1000) return;
            lastScanRef.current = { value, ts: now };
            setLastValue(value);
            onScan(value);
          }
        );
      } catch (err: any) {
        onError?.(err?.message || "Camera scanning unavailable in this browser.");
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
    };
  }, [active, elementId, fps, onError, onScan]);

  if (!active) return null;

  if (mode === "overlay") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: "#000",
          color: "#fff"
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <div id={elementId} style={{ width: "100%", height: "100%" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none"
            }}
          >
            <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "auto" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
              {onClose ? (
                <button
                  type="button"
                  className="button ghost"
                  onClick={onClose}
                  style={{ background: "rgba(0,0,0,0.45)", color: "#fff", borderColor: "rgba(255,255,255,0.35)" }}
                >
                  Close
                </button>
              ) : null}
            </div>

            <div
              style={{
                position: "relative",
                width: "70vw",
                maxWidth: 380,
                height: "22vh",
                maxHeight: 180,
                minHeight: 120,
                borderRadius: 12,
                border: "2px solid rgba(255,255,255,0.35)",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)"
              }}
            >
              <span style={{ position: "absolute", top: -4, left: -4, width: 28, height: 28, borderLeft: "4px solid #ff4a3d", borderTop: "4px solid #ff4a3d", borderTopLeftRadius: 8 }} />
              <span style={{ position: "absolute", top: -4, right: -4, width: 28, height: 28, borderRight: "4px solid #ff4a3d", borderTop: "4px solid #ff4a3d", borderTopRightRadius: 8 }} />
              <span style={{ position: "absolute", bottom: -4, left: -4, width: 28, height: 28, borderLeft: "4px solid #ff4a3d", borderBottom: "4px solid #ff4a3d", borderBottomLeftRadius: 8 }} />
              <span style={{ position: "absolute", bottom: -4, right: -4, width: 28, height: 28, borderRight: "4px solid #ff4a3d", borderBottom: "4px solid #ff4a3d", borderBottomRightRadius: 8 }} />
            </div>

            <div style={{ position: "absolute", bottom: 40, textAlign: "center", padding: "0 24px" }}>
              <div style={{ fontSize: 14, opacity: 0.9 }}>{subtitle}</div>
              {showLast && lastValue ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>Last scan: {lastValue}</div> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div id={elementId} style={{ width }} />
      {showLast && lastValue ? <div className="muted" style={{ marginTop: 6 }}>Last scan: {lastValue}</div> : null}
    </div>
  );
}
