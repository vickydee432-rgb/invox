const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true },
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    routingNumber: { type: String, trim: true },
    swift: { type: String, trim: true },
    mobileMoney: { type: String, trim: true },
    paymentInstructions: { type: String, trim: true }
  },
  { _id: false }
);

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    taxId: { type: String, trim: true },
    currency: { type: String, trim: true, default: "USD" },
    address: { type: AddressSchema, default: {} },
    payment: { type: PaymentSchema, default: {} },
    businessType: {
      type: String,
      enum: ["retail", "construction", "agency", "services", "freelance"],
      default: "construction",
      index: true
    },
    enabledModules: { type: [String], default: [] },
    labels: { type: mongoose.Schema.Types.Mixed, default: {} },
    taxEnabled: { type: Boolean, default: true },
    inventoryEnabled: { type: Boolean, default: false },
    projectTrackingEnabled: { type: Boolean, default: true },
    workspaceConfigured: { type: Boolean, default: false },
    subscriptionStatus: {
      type: String,
      enum: ["trialing", "active", "past_due", "cancelled", "expired", "inactive", "pending"],
      default: "pending",
      index: true
    },
    subscriptionPlan: { type: String, enum: ["starter", "pro", "businessplus"], default: "pro" },
    subscriptionCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    trialEndsAt: { type: Date },
    currentPeriodEnd: { type: Date },
    dodoSubscriptionId: { type: String, trim: true },
    dodoCustomerId: { type: String, trim: true },
    lastPaymentAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", CompanySchema);
