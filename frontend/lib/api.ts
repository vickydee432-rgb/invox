import { getToken } from "./auth";

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const normalizedApiUrl = rawApiUrl.startsWith("http")
  ? rawApiUrl
  : `https://${rawApiUrl.replace(/^\/+/, "")}`;
const API_URL = normalizedApiUrl.replace(/\/+$/, "");

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    data = text ? { error: text } : {};
  }

  if (!res.ok) {
    let message: any = data?.error ?? data?.message ?? "Request failed";
    if (typeof message === "object" && message) {
      message = message.message || JSON.stringify(message);
    }
    const err: any = new Error(String(message));
    err.details = data;
    throw err;
  }

  return data as T;
}

export async function apiDownload(path: string, filename: string) {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    let message = "Download failed";
    try {
      const data = JSON.parse(text);
      message = data?.error || message;
    } catch (err) {
      message = text || message;
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
