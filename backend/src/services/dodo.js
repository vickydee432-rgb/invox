const crypto = require("crypto");

function getDodoBaseUrl() {
  return process.env.DODO_PAYMENTS_BASE_URL || "https://api.dodopayments.com";
}

function getApiKey() {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) {
    const err = new Error("Missing DODO_PAYMENTS_API_KEY");
    err.status = 500;
    throw err;
  }
  return key;
}

async function dodoRequest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${getDodoBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json"
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
    console.error("Dodo request failed", {
      path,
      status: res.status,
      data
    });
    const error = new Error(data?.message || data?.error || "Dodo request failed");
    error.status = res.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function createCheckoutSession({ productId, customer, returnUrl, metadata }) {
  return dodoRequest("/checkouts", {
    method: "POST",
    body: {
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer,
      return_url: returnUrl,
      metadata
    }
  });
}

function verifyWebhookSignature({ rawBody, signature, webhookId, webhookTimestamp }) {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!secret) return true;
  const payload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return expected === signature;
}

module.exports = { createCheckoutSession, verifyWebhookSignature };
