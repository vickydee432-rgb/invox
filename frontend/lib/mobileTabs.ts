"use client";

export const DEFAULT_MOBILE_TABS = ["/dashboard", "/sales", "/inventory", "/reports"] as const;

export function isTabRootPathIn(tabs: readonly string[], pathname: string) {
  const normalized = pathname === "/" ? "/dashboard" : pathname;
  return tabs.includes(normalized) || pathname === "/";
}

export function activeTabIndexIn(tabs: readonly string[], pathname: string) {
  const normalized = pathname === "/" ? "/dashboard" : pathname;
  for (let i = 0; i < tabs.length; i++) {
    const href = tabs[i];
    if (normalized === href || normalized.startsWith(`${href}/`)) return i;
  }
  return -1;
}
