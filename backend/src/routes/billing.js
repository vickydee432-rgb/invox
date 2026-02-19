const express = require("express");
const { z } = require("zod");
const Company = require("../models/Company");
const { requireAuth } = require("../middleware/auth");
const { paypalRequest, verifyWebhookSignature } = require("../services/paypal");

const billingRouter = express.Router();

const SubscribeSchema = z.object({
  planKey: z.string().min(1),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional()
});

const PLAN_MAP = {
  starter_monthly: process.env.PAYPAL_PLAN_STARTER_MONTHLY,
  starter_yearly: process.env.PAYPAL_PLAN_STARTER_YEARLY,
  pro_monthly: process.env.PAYPAL_PLAN_PRO_MONTHLY,
  pro_yearly: process.env.PAYPAL_PLAN_PRO_YEARLY,
  businessplus_monthly: process.env.PAYPAL_PLAN_BUSINESSPLUS_MONTHLY,
  businessplus_yearly: process.env.PAYPAL_PLAN_BUSINESSPLUS_YEARLY
};

function applyPlanDetails(company, planId) {
  const planEntries = Object.entries(PLAN_MAP).filter(([, value]) => value);
  const match = planEntries.find(([, value]) => value === planId);
  if (!match) return;
  const [planKey] = match;
  if (planKey.startsWith("starter")) company.subscriptionPlan = "starter";
  if (planKey.startsWith("pro")) company.subscriptionPlan = "pro";
  if (planKey.startsWith("businessplus")) company.subscriptionPlan = "businessplus";
  company.subscriptionCycle = planKey.endsWith("yearly") ? "yearly" : "monthly";
}

function mapPaypalStatus(status) {
  const normalized = String(status || "").toUpperCase();
  switch (normalized) {
    case "ACTIVE":
      return "active";
    case "APPROVAL_PENDING":
      return "pending";
    case "SUSPENDED":
      return "past_due";
    case "CANCELLED":
      return "cancelled";
    case "EXPIRED":
      return "expired";
    default:
      return "inactive";
  }
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

billingRouter.get("/status", requireAuth, async (req, res) => {
  const company = await Company.findById(req.user.companyId).lean();
  if (!company) return res.status(404).json({ error: "Company not found" });
  const access = computeAccess(company);
  res.json({
    status: company.subscriptionStatus || "trialing",
    plan: company.subscriptionPlan || null,
    billingCycle: company.subscriptionCycle || null,
    paypalSubscriptionId: company.paypalSubscriptionId || null,
    ...access
  });
});

billingRouter.post("/paypal/subscribe", requireAuth, async (req, res) => {
  const parsed = SubscribeSchema.parse(req.body || {});
  const planId = PLAN_MAP[parsed.planKey];
  if (!planId) return res.status(400).json({ error: "Invalid plan" });

  const company = await Company.findById(req.user.companyId);
  if (!company) return res.status(404).json({ error: "Company not found" });

  const returnUrl = parsed.returnUrl || process.env.PAYPAL_RETURN_URL || "http://localhost:3000/settings";
  const cancelUrl = parsed.cancelUrl || process.env.PAYPAL_CANCEL_URL || "http://localhost:3000/settings";

  const payload = {
    plan_id: planId,
    custom_id: company._id.toString(),
    application_context: {
      brand_name: company.name || "Invox",
      return_url: returnUrl,
      cancel_url: cancelUrl,
      user_action: "SUBSCRIBE_NOW"
    }
  };

  const response = await paypalRequest("/v1/billing/subscriptions", { method: "POST", body: payload });
  const approveLink = (response.links || []).find((link) => link.rel === "approve");

  company.paypalSubscriptionId = response.id;
  company.paypalPlanId = planId;
  company.subscriptionStatus = mapPaypalStatus(response.status) || "pending";
  if (parsed.planKey.startsWith("starter")) company.subscriptionPlan = "starter";
  if (parsed.planKey.startsWith("pro")) company.subscriptionPlan = "pro";
  if (parsed.planKey.startsWith("businessplus")) company.subscriptionPlan = "businessplus";
  company.subscriptionCycle = parsed.planKey.endsWith("yearly") ? "yearly" : "monthly";
  await company.save();

  res.json({
    subscriptionId: response.id,
    approveUrl: approveLink?.href || null
  });
});

async function paypalWebhookHandler(req, res) {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body || {});
    const event = typeof req.body === "object" && !(req.body instanceof Buffer) ? req.body : JSON.parse(rawBody);
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : value])
    );

    if (webhookId) {
      const verified = await verifyWebhookSignature(headers, event, webhookId);
      if (!verified) return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const resource = event.resource || {};
    const subscriptionId = resource.id || resource.subscription_id;
    const customId = resource.custom_id || resource.custom || resource.customId;

    let company = null;
    if (customId) {
      company = await Company.findById(customId);
    }
    if (!company && subscriptionId) {
      company = await Company.findOne({ paypalSubscriptionId: subscriptionId });
    }
    if (!company) return res.json({ ok: true });

    if (subscriptionId) company.paypalSubscriptionId = subscriptionId;
    if (resource.plan_id) company.paypalPlanId = resource.plan_id;
    if (resource.status) company.subscriptionStatus = mapPaypalStatus(resource.status);
    if (resource.plan_id) applyPlanDetails(company, resource.plan_id);
    if (resource.billing_info?.next_billing_time) {
      company.currentPeriodEnd = new Date(resource.billing_info.next_billing_time);
    }
    if (resource.billing_info?.last_payment?.time) {
      company.lastPaymentAt = new Date(resource.billing_info.last_payment.time);
    }

    await company.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}

module.exports = { billingRouter, paypalWebhookHandler };
