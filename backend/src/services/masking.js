const MASK_CHAR = "*";

function maskValue(value, showLast = 4) {
  if (!value) return value;
  const str = String(value);
  if (str.length <= showLast) return MASK_CHAR.repeat(Math.max(4, str.length));
  const visible = str.slice(-showLast);
  return `${MASK_CHAR.repeat(Math.max(4, str.length - showLast))}${visible}`;
}

function maskTaxId(value) {
  return value ? maskValue(value, 4) : value;
}

function maskPayment(payment) {
  if (!payment) return payment;
  return {
    ...payment,
    accountNumber: payment.accountNumber ? maskValue(payment.accountNumber, 4) : payment.accountNumber,
    routingNumber: payment.routingNumber ? maskValue(payment.routingNumber, 4) : payment.routingNumber,
    swift: payment.swift ? maskValue(payment.swift, 3) : payment.swift,
    mobileMoney: payment.mobileMoney ? maskValue(payment.mobileMoney, 4) : payment.mobileMoney
  };
}

function sanitizeAuditPayload(payload) {
  const redactKeys = new Set([
    "password",
    "passwordHash",
    "token",
    "resetToken",
    "resetTokenHash",
    "secret",
    "key",
    "auth",
    "authorization",
    "payment",
    "paymentInstructions",
    "accountNumber",
    "routingNumber",
    "swift",
    "mobileMoney",
    "taxId"
  ]);

  function walk(value) {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.keys(value).reduce((acc, k) => {
        if (redactKeys.has(k)) {
          acc[k] = "[REDACTED]";
        } else {
          acc[k] = walk(value[k]);
        }
        return acc;
      }, {});
    }
    return value;
  }

  return walk(payload);
}

module.exports = { maskValue, maskTaxId, maskPayment, sanitizeAuditPayload };
