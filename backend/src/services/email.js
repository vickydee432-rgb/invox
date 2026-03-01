const nodemailer = require("nodemailer");

let cachedTransport = null;

function buildTransport() {
  if (cachedTransport) return cachedTransport;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !user || !pass) {
    return null;
  }

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
  return cachedTransport;
}

async function sendMail({ to, subject, html, text }) {
  const transport = buildTransport();
  if (!transport) {
    console.warn("SMTP not configured; skipping email send");
    return { sent: false };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({ from, to, subject, html, text });
  return { sent: true };
}

function buildResetEmail({ resetUrl, token, email }) {
  const subject = "Reset your INVOX password";
  const text = `You requested a password reset.\n\nReset link: ${resetUrl}\n\nIf prompted, use this token: ${token}\n\nIf you did not request this, ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Reset your INVOX password</h2>
      <p>You requested a password reset for <strong>${email}</strong>.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>If the link doesn’t open, copy this token into the reset page:</p>
      <p style="font-family: monospace; font-size: 16px;">${token}</p>
      <p>If you did not request this, ignore this email.</p>
    </div>
  `;
  return { subject, text, html };
}

module.exports = { sendMail, buildResetEmail };
