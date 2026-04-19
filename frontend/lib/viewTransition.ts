"use client";

export function startViewTransition(action: () => void) {
  if (typeof document === "undefined") {
    action();
    return;
  }

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const anyDoc = document as any;
  const start = anyDoc?.startViewTransition;
  if (prefersReduced || typeof start !== "function") {
    action();
    return;
  }

  try {
    start.call(anyDoc, action);
  } catch {
    action();
  }
}

