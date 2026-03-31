async function sendSms({ to, body }) {
  const provider = String(process.env.SMS_PROVIDER || "").trim().toLowerCase();
  const isTwilio = provider === "twilio" || (!provider && process.env.TWILIO_ACCOUNT_SID);

  if (!to || !body) return { sent: false };

  if (process.env.SMS_ENABLED === "false") {
    console.warn("SMS disabled; skipping send");
    return { sent: false };
  }

  if (!isTwilio) {
    console.warn("SMS provider not configured; skipping SMS send");
    return { sent: false };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER || process.env.SMS_FROM_NUMBER;
  if (!accountSid || !authToken || !from) {
    console.warn("Twilio not configured; skipping SMS send");
    return { sent: false };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const params = new URLSearchParams();
  params.set("To", String(to));
  params.set("From", String(from));
  params.set("Body", String(body));

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`SMS send failed (${res.status})`);
    err.details = text;
    throw err;
  }

  return { sent: true };
}

module.exports = { sendSms };

