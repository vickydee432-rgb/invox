require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../models/Company");
const { setCompanySensitive } = require("../services/companySensitive");

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGO_URI");
  await mongoose.connect(uri);

  const cursor = Company.find({
    $or: [
      { taxId: { $exists: true, $ne: null, $ne: "" } },
      { "payment.accountNumber": { $exists: true, $ne: null, $ne: "" } },
      { "payment.routingNumber": { $exists: true, $ne: null, $ne: "" } },
      { "payment.swift": { $exists: true, $ne: null, $ne: "" } },
      { "payment.mobileMoney": { $exists: true, $ne: null, $ne: "" } }
    ]
  }).cursor();

  let updated = 0;
  for await (const company of cursor) {
    if (company.taxIdEncrypted || company.paymentEncrypted) continue;
    setCompanySensitive(company, { taxId: company.taxId, payment: company.payment });
    await company.save();
    updated += 1;
  }

  console.log(`Encrypted ${updated} companies.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
