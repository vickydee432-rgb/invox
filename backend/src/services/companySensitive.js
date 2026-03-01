const { encryptJson, decryptJson, encryptString, decryptString } = require("./dataCrypto");
const { maskTaxId, maskPayment } = require("./masking");

function hasPaymentValue(payment) {
  if (!payment) return false;
  return Object.values(payment).some((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function setCompanySensitive(company, { taxId, payment } = {}) {
  try {
    if (taxId !== undefined) {
      company.taxIdEncrypted = encryptString(taxId);
      company.taxId = undefined;
    }
    if (payment !== undefined) {
      company.paymentEncrypted = hasPaymentValue(payment) ? encryptJson(payment) : undefined;
      company.payment = undefined;
    }
  } catch (err) {
    console.error("Sensitive encryption failed", err?.message || err);
    if (taxId !== undefined) company.taxId = taxId;
    if (payment !== undefined) company.payment = payment;
  }
}

function getCompanySensitive(company) {
  let taxId = null;
  let payment = null;

  if (company?.taxIdEncrypted) {
    try {
      taxId = decryptString(company.taxIdEncrypted);
    } catch (err) {
      taxId = null;
    }
  } else if (company?.taxId) {
    taxId = company.taxId;
  }

  if (company?.paymentEncrypted) {
    try {
      payment = decryptJson(company.paymentEncrypted);
    } catch (err) {
      payment = null;
    }
  } else if (company?.payment) {
    payment = company.payment;
  }

  return { taxId, payment };
}

function hydrateCompanySensitive(company) {
  if (!company) return company;
  const { taxId, payment } = getCompanySensitive(company);
  return { ...company, taxId, payment };
}

function sanitizeCompany(company, { revealSensitive = false } = {}) {
  if (!company) return company;
  const { taxId, payment } = getCompanySensitive(company);
  const maskedTaxId = maskTaxId(taxId);
  const maskedPayment = maskPayment(payment);
  const safe = {
    ...company,
    taxId: revealSensitive ? taxId : maskedTaxId,
    payment: revealSensitive ? payment : maskedPayment,
    taxIdMasked: maskedTaxId,
    paymentMasked: maskedPayment
  };
  delete safe.taxIdEncrypted;
  delete safe.paymentEncrypted;
  return safe;
}

module.exports = { setCompanySensitive, getCompanySensitive, hydrateCompanySensitive, sanitizeCompany };
