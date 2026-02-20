const express = require("express");
const { z } = require("zod");
const Company = require("../models/Company");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { createCheckoutSession, verifyWebhookSignature } = require("../services/dodo");
const { handleRouteError } = require("./_helpers");

const billingRouter = express.Router();
billingRouter.use(requireAuth);

const SubscribeSchema = z
  .object({
    planKey: z.string().min(1).optional(),
    product_id: z.string().min(1).optional(),
    productId: z.string().min(1).optional(),
    returnUrl: z.string().url().optional()
  })
  .refine((data) => data.planKey || data.product_id || data.productId, {
    message: "planKey or product_id is required"
  });

const PLAN_MAP = {
  starter_monthly: process.env.DODO_PRODUCT_STARTER_MONTHLY,
  starter_yearly: process.env.DODO_PRODUCT_STARTER_YEARLY,
  pro_monthly: process.env.DODO_PRODUCT_PRO_MONTHLY,
  pro_yearly: process.env.DODO_PRODUCT_PRO_YEARLY,
  businessplus_monthly: process.env.DODO_PRODUCT_BUSINESSPLUS_MONTHLY,
  businessplus_yearly: process.env.DODO_PRODUCT_BUSINESSPLUS_YEARLY
};

function applyPlanDetails(company, productId) {
  const entries = Object.entries(PLAN_MAP).filter(([, value]) => value);
  const match = entries.find(([, value]) => value === productId);
  if (!match) return;
  const [planKey] = match;
  if (planKey.startsWith("starter")) company.subscriptionPlan = "starter";
  if (planKey.startsWith("pro")) company.subscriptionPlan = "pro";
  if (planKey.startsWith("businessplus")) company.subscriptionPlan = "businessplus";
  company.subscriptionCycle = planKey.endsWith("yearly") ? "yearly" : "monthly";
}

function computeAccess(company) {
  const now = new Date();
  const trialValid = company.trialEndsAt && company.trialEndsAt > now;
  const periodValid = company.currentPeriodEnd && company.currentPeriodEnd > now;
  const isActive = company.subscriptionStatus === "active" || trialValid || periodValid;
  return {
    isActive,
    isTrial: !!trialValid,
    readOnly: !isActive,
    trialEndsAt: company.trialEndsAt,
    currentPeriodEnd: company.currentPeriodEnd
  };
}

billingRouter.get("/status", async (req, res) => {
  const company = await Company.findById(req.user.companyId).lean();
  if (!company) return res.status(404).json({ error: "Company not found" });
  const access = computeAccess(company);
  res.json({
    status: company.subscriptionStatus || "trialing",
    plan: company.subscriptionPlan || null,
    billingCycle: company.subscriptionCycle || null,
    dodoSubscriptionId: company.dodoSubscriptionId || null,
    ...access
  });
});

billingRouter.post("/checkout", async (req, res) => {
  try {
    const parsed = SubscribeSchema.parse(req.body || {});
    const requestedProductId = parsed.product_id || parsed.productId;
    const planKey = parsed.planKey || "";
    const productId = requestedProductId || PLAN_MAP[planKey];
    if (!productId) return res.status(400).json({ error: "Invalid plan or product" });

    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const returnUrl = parsed.returnUrl || process.env.DODO_RETURN_URL || "http://localhost:3000/plans";
    const customer = {
      email: req.user.email,
      name: req.user.name
    };
    const metadata = {
      companyId: company._id.toString(),
      planKey: planKey || undefined,
      productId
    };

    console.log("Dodo checkout request", {
      companyId: company._id.toString(),
      planKey: planKey || undefined,
      productId,
      returnUrl,
      baseUrl: process.env.DODO_PAYMENTS_BASE_URL || "https://api.dodopayments.com"
    });

    const session = await createCheckoutSession({ productId, customer, returnUrl, metadata });

    company.subscriptionStatus = "pending";
    applyPlanDetails(company, productId);
    await company.save();

    res.json({ checkoutUrl: session.checkout_url || session.checkoutUrl });
  } catch (err) {
    console.error("Checkout error", err?.message || err, err?.details || "");
    return handleRouteError(res, err, "Failed to start checkout");
  }
});

async function dodoWebhookHandler(req, res) {
  try {
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body || {});
    const signature =
      req.headers["webhook-signature"] ||
      req.headers["x-webhook-signature"] ||
      req.headers["dodo-webhook-signature"] ||
      req.headers["dodo-signature"];
    const webhookId =
      req.headers["webhook-id"] || req.headers["x-webhook-id"] || req.headers["dodo-webhook-id"];
    const webhookTimestamp =
      req.headers["webhook-timestamp"] ||
      req.headers["x-webhook-timestamp"] ||
      req.headers["dodo-webhook-timestamp"];
    console.log({
      hasBuffer: req.body instanceof Buffer,
      rawLen: req.body instanceof Buffer ? req.body.length : 0,
      webhookId: req.headers["webhook-id"],
      webhookSignature: req.headers["webhook-signature"],
      webhookTimestamp: req.headers["webhook-timestamp"]
    });
    if (process.env.DODO_DISABLE_WEBHOOK_VERIFY !== "true") {
      if (!verifyWebhookSignature({ rawBody, signature, webhookId, webhookTimestamp })) {
        console.error("Invalid webhook signature", { webhookId, webhookTimestamp });
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
    }

    const event = typeof req.body === "object" && !(req.body instanceof Buffer) ? req.body : JSON.parse(rawBody);
    const payload = event.data?.subscription || event.data?.object || event.data || event;
    const companyId = payload.metadata?.companyId || payload.customer?.metadata?.companyId;

    let company = null;
    if (companyId) {
      company = await Company.findById(companyId);
    } else if (payload.customer_id) {
      company = await Company.findOne({ dodoCustomerId: payload.customer_id });
    } else if (payload.customer?.customer_id) {
      company = await Company.findOne({ dodoCustomerId: payload.customer.customer_id });
    } else if (payload.customer?.email) {
      const user = await User.findOne({ email: String(payload.customer.email).toLowerCase() });
      if (user) company = await Company.findById(user.companyId);
    } else if (payload.email) {
      const user = await User.findOne({ email: String(payload.email).toLowerCase() });
      if (user) company = await Company.findById(user.companyId);
    } else if (payload.subscription_id) {
      company = await Company.findOne({ dodoSubscriptionId: payload.subscription_id });
    }
    if (!company) {
      console.warn("Webhook received but company not found", { customerId: payload.customer_id });
      return res.json({ ok: true });
    }

    if (payload.customer_id) company.dodoCustomerId = payload.customer_id;
    if (payload.customer?.customer_id) company.dodoCustomerId = payload.customer.customer_id;
    if (payload.id) company.dodoSubscriptionId = payload.id;
    if (payload.subscription_id) company.dodoSubscriptionId = payload.subscription_id;
    if (payload.product_id) applyPlanDetails(company, payload.product_id);

    const eventType = String(event.type || "").toLowerCase();
    const status = String(payload.status || "").toLowerCase();
    console.log("Webhook event", {
      eventType,
      status,
      companyId: company._id.toString(),
      productId: payload.product_id || payload.productId
    });
    if (eventType.includes("cancel") || status === "cancelled") company.subscriptionStatus = "cancelled";
    else if (eventType.includes("expire") || status === "expired") company.subscriptionStatus = "expired";
    else if (eventType.includes("payment_failed") || status === "past_due") company.subscriptionStatus = "past_due";
    else if (eventType.includes("activate") || status === "active") company.subscriptionStatus = "active";
    else if (status === "trialing") company.subscriptionStatus = "trialing";

    const periodEnd = payload.current_period_end || payload.current_period_end_at || payload.next_billing_date;
    if (periodEnd) company.currentPeriodEnd = new Date(periodEnd);

    await company.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}

module.exports = { billingRouter, dodoWebhookHandler };
