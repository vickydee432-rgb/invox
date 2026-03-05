"use client";

const DEVICE_KEY = "invox_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let deviceId = window.localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
}

export function setDeviceId(value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEVICE_KEY, value);
}
