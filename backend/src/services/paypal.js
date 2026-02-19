const cache = { token: null, expiresAt: 0 };

function getPaypalBaseUrl() {
  return process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";
}

function getClientCreds() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    const err = new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET");
    err.status = 500;
    throw err;
  }
  return { clientId, secret };
}

async function getAccessToken() {
  const now = Date.now();
  if (cache.token && cache.expiresAt > now + 60000) return cache.token;

  const { clientId, secret } = getClientCreds();
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const res = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error_description || "Failed to get PayPal token");
    err.status = res.status;
    throw err;
  }
  cache.token = data.access_token;
  cache.expiresAt = now + (data.expires_in || 0) * 1000;
  return cache.token;
}

async function paypalRequest(path, { method = "GET", body, headers = {} } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${getPaypalBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers
    },
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
    const err = new Error(data?.message || data?.error || "PayPal request failed");
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

async function verifyWebhookSignature(headers, body, webhookId) {
  if (!webhookId) return true;
  const payload = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: body
  };
  const data = await paypalRequest("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: payload
  });
  return data.verification_status === "SUCCESS";
}

module.exports = { paypalRequest, verifyWebhookSignature };
