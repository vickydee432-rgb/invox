const crypto = require("crypto");

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.DATA_ENCRYPTION_KEY || process.env.ZRA_CREDENTIALS_KEY;
  if (!raw) {
    throw new Error("Missing DATA_ENCRYPTION_KEY");
  }
  let key;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
  }
  cachedKey = key;
  return key;
}

function encryptJson(payload) {
  if (payload === undefined || payload === null) return null;
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

function decryptJson(envelope) {
  if (!envelope?.cipherText || !envelope?.iv || !envelope?.tag) return null;
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.cipherText, "base64")),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function encryptString(value) {
  if (value === undefined || value === null || value === "") return null;
  return encryptJson({ value });
}

function decryptString(envelope) {
  const payload = decryptJson(envelope);
  return payload?.value ?? null;
}

module.exports = { encryptJson, decryptJson, encryptString, decryptString };
