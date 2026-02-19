const express = require("express");
const { z } = require("zod");
const Company = require("../models/Company");
const { createCheckoutSession, verifyWebhookSignature } = require("../services/dodo");

const billingRouter = express.Router();

const SubscribeSchema = z.object({
  planKey: z.string().min(1),
  returnUrl: z.string().url().optional()
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
  const parsed = SubscribeSchema.parse(req.body || {});
  const productId = PLAN_MAP[parsed.planKey];
  if (!productId) return res.status(400).json({ error: "Invalid plan" });

  const company = await Company.findById(req.user.companyId);
  if (!company) return res.status(404).json({ error: "Company not found" });

  const returnUrl = parsed.returnUrl || process.env.DODO_RETURN_URL || "http://localhost:3000/plans";
  const customer = {
    email: req.user.email,
    name: req.user.name
  };
  const metadata = {
    companyId: company._id.toString(),
    planKey: parsed.planKey
  };

  const session = await createCheckoutSession({ productId, customer, returnUrl, metadata });

  company.subscriptionStatus = "pending";
  applyPlanDetails(company, productId);
  await company.save();

  res.json({ checkoutUrl: session.checkout_url || session.checkoutUrl });
});

async function dodoWebhookHandler(req, res) {
  try {
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body || {});
    const signature = req.headers["webhook-signature"];
    const webhookId = req.headers["webhook-id"];
    const webhookTimestamp = req.headers["webhook-timestamp"];
    if (!verifyWebhookSignature({ rawBody, signature, webhookId, webhookTimestamp })) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = typeof req.body === "object" && !(req.body instanceof Buffer) ? req.body : JSON.parse(rawBody);
    const payload = event.data?.subscription || event.data?.object || event.data || event;
    const companyId = payload.metadata?.companyId || payload.customer?.metadata?.companyId;

    let company = null;
    if (companyId) {
      company = await Company.findById(companyId);
    } else if (payload.customer_id) {
      company = await Company.findOne({ dodoCustomerId: payload.customer_id });
    }
    if (!company) return res.json({ ok: true });

    if (payload.customer_id) company.dodoCustomerId = payload.customer_id;
    if (payload.id) company.dodoSubscriptionId = payload.id;
    if (payload.product_id) applyPlanDetails(company, payload.product_id);

    const eventType = String(event.type || "").toLowerCase();
    const status = String(payload.status || "").toLowerCase();
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
