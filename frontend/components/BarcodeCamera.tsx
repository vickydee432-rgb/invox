"use client";

import { useEffect, useId, useRef } from "react";

type BarcodeCameraProps = {
  active: boolean;
  onScan: (value: string) => void;
  onError?: (message: string) => void;
  width?: number;
  fps?: number;
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

export default function BarcodeCamera({ active, onScan, onError, width = 280, fps = 10 }: BarcodeCameraProps) {
  const elementId = useId();
  const qrRef = useRef<any>(null);
  const lastScanRef = useRef<{ value: string; ts: number } | null>(null);

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
        await instance.start(
          cameraId,
          { fps, qrbox: 220 },
          (decodedText: string) => {
            const value = String(decodedText || "").trim();
            if (!value) return;
            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.value === value && now - last.ts < 1000) return;
            lastScanRef.current = { value, ts: now };
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

  return <div id={elementId} style={{ width }} />;
}
