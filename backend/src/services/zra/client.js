const { decryptJson } = require("./crypto");

function buildHeaders(credentials, extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  if (!credentials) return headers;
  if (credentials.authType === "basic" && credentials.username && credentials.password) {
    const token = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  } else if (credentials.authType === "bearer" && credentials.accessToken) {
    headers.Authorization = `Bearer ${credentials.accessToken}`;
  } else if (credentials.apiKey) {
    headers.Authorization = `Bearer ${credentials.apiKey}`;
  }
  return headers;
}

async function zraRequest(connection, path, { method = "GET", body, headers = {} } = {}) {
  const baseUrl = connection.baseUrl || process.env.ZRA_API_BASE_URL;
  if (!baseUrl) {
    const err = new Error("ZRA API base URL not configured");
    err.status = 500;
    throw err;
  }
  const credentials = decryptJson(connection.credentials);
  const finalHeaders = buildHeaders(credentials, headers);
  const url = `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const error = new Error(data?.error || "ZRA request failed");
    error.status = res.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function fetchNotices(connection, since) {
  const params = since ? `?since=${encodeURIComponent(since.toISOString())}` : "";
  return zraRequest(connection, `/notices${params}`);
}

async function fetchInvoiceDetails(connection, receiptNo) {
  return zraRequest(connection, `/invoices/${encodeURIComponent(receiptNo)}`);
}

async function submitInvoice(connection, payload) {
  return zraRequest(connection, "/invoices", { method: "POST", body: payload });
}

async function submitCancel(connection, payload) {
  return zraRequest(connection, "/invoices/cancel", { method: "POST", body: payload });
}

async function submitCreditNote(connection, payload) {
  return zraRequest(connection, "/invoices/credit-note", { method: "POST", body: payload });
}

module.exports = {
  zraRequest,
  fetchNotices,
  fetchInvoiceDetails,
  submitInvoice,
  submitCancel,
  submitCreditNote
};
