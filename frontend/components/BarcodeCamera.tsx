"use client";

import { useEffect, useRef, useState } from "react";

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
  status?: string;
  statusTone?: "neutral" | "success" | "error";
};

const loadHtml5Qrcode = async () => {
  if (typeof window === "undefined") throw new Error("No window");
  const mod: any = await import("html5-qrcode");
  const Html5Qrcode = mod?.Html5Qrcode || mod?.default?.Html5Qrcode || mod?.default || mod;
  const Html5QrcodeSupportedFormats =
    mod?.Html5QrcodeSupportedFormats || mod?.default?.Html5QrcodeSupportedFormats || undefined;
  return { Html5Qrcode, Html5QrcodeSupportedFormats };
};

const pickCameraId = (cameras: { id: string; label: string }[]) => {
  if (!cameras.length) return null;
  const preferred = cameras.find((camera) => /back|rear|environment/i.test(camera.label || ""));
  if (preferred) return preferred.id || null;
  const hasLabel = cameras.some((camera) => Boolean(camera.label));
  if (!hasLabel) return null;
  return cameras[0]?.id || null;
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
  subtitle = "Align the barcode within the frame",
  status,
  statusTone = "neutral"
}: BarcodeCameraProps) {
  const elementIdRef = useRef<string | null>(null);
  if (!elementIdRef.current) {
    elementIdRef.current = `barcode-camera-${Math.random().toString(36).slice(2, 10)}`;
  }
  const elementId = elementIdRef.current;
  const qrRef = useRef<any>(null);
  const lastScanRef = useRef<{ value: string; ts: number } | null>(null);
  const [lastValue, setLastValue] = useState("");

  useEffect(() => {
    if (!active) return;
    let mounted = true;

    const start = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await loadHtml5Qrcode();
        if (!mounted || !Html5Qrcode) return;
        const cameras = (await Html5Qrcode.getCameras?.()) || [];
        const cameraId = pickCameraId(cameras);
        const cameraTarget = cameraId || { facingMode: "environment" };
        const instance = new Html5Qrcode(elementId);
        qrRef.current = instance;
        const qrbox =
          mode === "overlay"
            ? (viewfinderWidth: number, viewfinderHeight: number) => ({
                width: Math.min(viewfinderWidth * 0.85, 420),
                height: Math.min(viewfinderHeight * 0.32, 200)
              })
            : 220;
        const formats = Html5QrcodeSupportedFormats
          ? [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.CODE_93,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.CODABAR
            ]
          : undefined;
        const startConfig = {
          fps,
          qrbox,
          aspectRatio: 1.333,
          disableFlip: false,
          formatsToSupport: formats,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        };
        const onDecoded = (decodedText: string) => {
          const value = String(decodedText || "").trim();
          if (!value) return;
          const now = Date.now();
          const last = lastScanRef.current;
          if (last && last.value === value && now - last.ts < 1000) return;
          lastScanRef.current = { value, ts: now };
          setLastValue(value);
          onScan(value);
        };
        try {
          await instance.start(cameraTarget as any, startConfig, onDecoded);
        } catch (err) {
          if (cameraId || cameras.length === 0) throw err;
          await instance.start(cameras[0].id, startConfig, onDecoded);
        }
        const host = document.getElementById(elementId);
        const video = host?.querySelector("video") as HTMLVideoElement | null;
        if (video) {
          video.setAttribute("playsinline", "true");
          video.setAttribute("muted", "true");
          video.setAttribute("autoplay", "true");
          video.muted = true;
          video.style.width = "100%";
          video.style.height = "100%";
          video.style.objectFit = "cover";
        }
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
              {status ? (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color:
                      statusTone === "success"
                        ? "#7dff9a"
                        : statusTone === "error"
                          ? "#ff7d7d"
                          : "#ffffff"
                  }}
                >
                  {status}
                </div>
              ) : null}
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
