"use client";

import { getDeviceId } from "./device";

export type ReceiptPrintingMode = "paid" | "all";

export type ReceiptPrintingDeviceSettings = {
  autoPrintAfterSale: boolean;
  autoPrintMode: ReceiptPrintingMode;
};

const SETTINGS_PREFIX = "invox_receipt_printing_v1:";

export function getReceiptPrintingDeviceSettings(): ReceiptPrintingDeviceSettings {
  if (typeof window === "undefined") return { autoPrintAfterSale: false, autoPrintMode: "paid" };
  const key = `${SETTINGS_PREFIX}${getDeviceId()}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { autoPrintAfterSale: false, autoPrintMode: "paid" };
    const parsed = JSON.parse(raw);
    return {
      autoPrintAfterSale: Boolean(parsed?.autoPrintAfterSale),
      autoPrintMode: parsed?.autoPrintMode === "all" ? "all" : "paid"
    };
  } catch {
    return { autoPrintAfterSale: false, autoPrintMode: "paid" };
  }
}

export function setReceiptPrintingDeviceSettings(next: ReceiptPrintingDeviceSettings) {
  if (typeof window === "undefined") return;
  const key = `${SETTINGS_PREFIX}${getDeviceId()}`;
  window.localStorage.setItem(
    key,
    JSON.stringify({
      autoPrintAfterSale: Boolean(next.autoPrintAfterSale),
      autoPrintMode: next.autoPrintMode === "all" ? "all" : "paid"
    })
  );
}

type ReceiptSettings = {
  showLogo?: boolean;
  footerMessage?: string;
};

type ReceiptCompany = {
  name?: string;
  legalName?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  currency?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  receiptSettings?: ReceiptSettings;
};

type ReceiptLine = {
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
  lineTotal?: number;
};

export type PrintableReceipt = {
  receiptNo?: string;
  referenceNo?: string;
  issueDate?: string | Date;
  customerName?: string;
  items: ReceiptLine[];
  subtotal: number;
  vatRate?: number;
  vatAmount: number;
  total: number;
  amountPaid?: number;
  balance?: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(2);
}

function formatDateTime(value?: string | Date) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function buildReceiptHtml({
  company,
  receipt
}: {
  company: ReceiptCompany;
  receipt: PrintableReceipt;
}) {
  const currency = company.currency || "USD";
  const showLogo = company.receiptSettings?.showLogo !== false;
  const footer = (company.receiptSettings?.footerMessage || "Thank you for shopping with us.").trim();

  const addressParts = [
    company.address?.line1,
    company.address?.line2,
    [company.address?.city, company.address?.state, company.address?.postalCode].filter(Boolean).join(" "),
    company.address?.country
  ]
    .filter(Boolean)
    .map((row) => String(row).trim())
    .filter(Boolean);

  const headerMeta = [company.phone, company.email].filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
  const dt = formatDateTime(receipt.issueDate);

  const itemRows = (receipt.items || []).map((item) => {
    const qty = Number(item.qty || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);
    const lineTotal =
      item.lineTotal !== undefined ? Number(item.lineTotal || 0) : Math.max(0, qty * unitPrice - discount);
    const desc = escapeHtml(String(item.description || "").trim());
    return `
      <div class="item">
        <div class="item-desc">${desc}</div>
        <div class="item-line">
          <span>${qty} x ${escapeHtml(currency)} ${formatMoney(unitPrice)}</span>
          <span>${escapeHtml(currency)} ${formatMoney(lineTotal)}</span>
        </div>
      </div>
    `;
  });

  const receiptNo = receipt.receiptNo ? escapeHtml(String(receipt.receiptNo)) : "";
  const referenceNo = receipt.referenceNo ? escapeHtml(String(receipt.referenceNo)) : "";
  const customerName = receipt.customerName ? escapeHtml(String(receipt.customerName)) : "";

  const vatRate = Number(receipt.vatRate || 0);
  const amountPaid = receipt.amountPaid !== undefined ? Number(receipt.amountPaid || 0) : null;
  const balance = receipt.balance !== undefined ? Number(receipt.balance || 0) : null;

  const totalsRows = `
    <div class="row"><span>Subtotal</span><span>${escapeHtml(currency)} ${formatMoney(receipt.subtotal)}</span></div>
    ${
      vatRate > 0
        ? `<div class="row"><span>VAT (${vatRate}%)</span><span>${escapeHtml(currency)} ${formatMoney(receipt.vatAmount)}</span></div>`
        : ""
    }
    <div class="row total"><span>Total</span><span>${escapeHtml(currency)} ${formatMoney(receipt.total)}</span></div>
    ${amountPaid !== null ? `<div class="row"><span>Paid</span><span>${escapeHtml(currency)} ${formatMoney(amountPaid)}</span></div>` : ""}
    ${balance !== null ? `<div class="row"><span>Balance</span><span>${escapeHtml(currency)} ${formatMoney(balance)}</span></div>` : ""}
  `;

  const logoHtml =
    showLogo && company.logoUrl
      ? `<div class="logo"><img src="${escapeHtml(company.logoUrl)}" alt="logo" /></div>`
      : "";

  const companyName = escapeHtml(String(company.name || ""));
  const legalName = company.legalName ? escapeHtml(String(company.legalName)) : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Receipt</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0; padding: 0; }
      body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; color: #000; }
      .wrap { padding: 10px 10px 14px; }
      .center { text-align: center; }
      .muted { opacity: 0.75; }
      .logo img { max-width: 220px; max-height: 70px; object-fit: contain; }
      .title { font-size: 16px; font-weight: 700; margin: 6px 0 2px; }
      .line { border-top: 1px dashed #000; margin: 10px 0; }
      .meta { margin-top: 6px; }
      .meta div { margin: 2px 0; }
      .item { margin: 8px 0; }
      .item-desc { font-weight: 600; }
      .item-line { display: flex; justify-content: space-between; gap: 10px; }
      .totals { margin-top: 10px; }
      .row { display: flex; justify-content: space-between; gap: 12px; margin: 3px 0; }
      .row.total { font-weight: 800; font-size: 14px; }
      .footer { margin-top: 10px; }
      .actions { display: none; }
      @media screen {
        body { background: #f6f7f9; padding: 18px; }
        .wrap { background: #fff; border: 1px solid #e6e8ef; border-radius: 10px; max-width: 380px; margin: 0 auto; }
        .actions { display: flex; gap: 10px; justify-content: center; margin-top: 12px; }
        button { padding: 10px 12px; border-radius: 10px; border: 1px solid #d7dbe6; background: #fff; cursor: pointer; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      ${logoHtml}
      <div class="center">
        <div class="title">${companyName}</div>
        ${legalName ? `<div class="muted">${legalName}</div>` : ""}
        ${addressParts.map((row) => `<div class="muted">${escapeHtml(row)}</div>`).join("")}
        ${headerMeta.map((row) => `<div class="muted">${escapeHtml(row)}</div>`).join("")}
      </div>

      <div class="line"></div>

      <div class="meta">
        ${receiptNo ? `<div><strong>Receipt:</strong> ${receiptNo}</div>` : ""}
        ${referenceNo ? `<div><strong>Ref:</strong> ${referenceNo}</div>` : ""}
        ${dt ? `<div><strong>Date:</strong> ${escapeHtml(dt)}</div>` : ""}
        ${customerName ? `<div><strong>Customer:</strong> ${customerName}</div>` : ""}
      </div>

      <div class="line"></div>

      <div class="items">
        ${itemRows.join("")}
      </div>

      <div class="line"></div>

      <div class="totals">${totalsRows}</div>

      ${footer ? `<div class="footer center muted">${escapeHtml(footer)}</div>` : ""}

      <div class="actions">
        <button onclick="window.print()">Print</button>
      </div>
    </div>

    <script>
      (function () {
        const params = new URLSearchParams(location.search);
        if (params.get("autoprint") === "1") {
          const closeAfter = params.get("close") === "1";
          window.addEventListener("afterprint", function () {
            if (closeAfter) window.close();
          });
          setTimeout(function () { window.print(); }, 350);
          if (closeAfter) {
            // Fallback for browsers that don't fire afterprint reliably.
            setTimeout(function () { try { window.close(); } catch (e) {} }, 30000);
          }
        }
      })();
    </script>
  </body>
</html>`;
}

export function openPrintWindow() {
  if (typeof window === "undefined") return null;
  // Note: using `noopener,noreferrer` can cause some browsers to return a Window reference
  // that we can't write to, resulting in a blank/black window. Keep a writable reference.
  const w = window.open("", "_blank", "width=420,height=640");
  try {
    if (w) w.opener = null;
  } catch {
    // ignore
  }
  return w;
}

export function writeAndPrintHtml(
  printWindow: Window | null,
  html: string,
  { autoClose = true }: { autoClose?: boolean } = {}
) {
  if (!printWindow) return false;
  try {
    printWindow.document.open();
    const urlSuffix = autoClose ? "?autoprint=1&close=1" : "?autoprint=1";
    try {
      // Keep this window same-origin by writing content directly.
      // The query string is just used by the inline script above.
      printWindow.history.replaceState({}, "", urlSuffix);
    } catch {
      // ignore history errors (some browsers disallow this on about:blank)
    }
    printWindow.document.write(html);
    printWindow.document.close();
    try {
      printWindow.focus();
    } catch {
      // ignore
    }
    return true;
  } catch {
    return false;
  }
}
