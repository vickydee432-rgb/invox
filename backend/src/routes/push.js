const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const PushSubscription = require("../models/PushSubscription");
const { getVapidPublicKey, isPushEnabled } = require("../services/push");
const { handleRouteError } = require("./_helpers");

const router = express.Router();
router.use(requireAuth, requireSubscription);

router.get("/public-key", (req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(501).json({ error: "Push not configured (missing VAPID_PUBLIC_KEY)" });
  res.json({ publicKey: key, enabled: isPushEnabled() });
});

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

router.get("/me", async (req, res) => {
  try {
    const count = await PushSubscription.countDocuments({ companyId: req.user.companyId, userId: req.user._id });
    res.json({ subscribed: count > 0, enabled: isPushEnabled() });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load push status");
  }
});

router.post("/subscribe", async (req, res) => {
  try {
    const parsed = z
      .object({
        deviceId: z.string().min(1).optional(),
        userAgent: z.string().optional(),
        subscription: SubscriptionSchema
      })
      .parse(req.body || {});

    const sub = parsed.subscription;
    await PushSubscription.findOneAndUpdate(
      { companyId: req.user.companyId, endpoint: sub.endpoint },
      {
        $set: {
          userId: req.user._id,
          deviceId: parsed.deviceId,
          expirationTime: sub.expirationTime ?? null,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          userAgent: parsed.userAgent,
          lastSeenAt: new Date()
        },
        $setOnInsert: { companyId: req.user.companyId, endpoint: sub.endpoint }
      },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to subscribe to push");
  }
});

router.post("/unsubscribe", async (req, res) => {
  try {
    const parsed = z
      .object({
        endpoint: z.string().optional(),
        deviceId: z.string().optional()
      })
      .parse(req.body || {});
    if (!parsed.endpoint && !parsed.deviceId) return res.status(400).json({ error: "Provide endpoint or deviceId" });

    const filter = { companyId: req.user.companyId, userId: req.user._id };
    if (parsed.endpoint) filter.endpoint = parsed.endpoint;
    if (parsed.deviceId) filter.deviceId = parsed.deviceId;

    await PushSubscription.deleteMany(filter);
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to unsubscribe from push");
  }
});

module.exports = router;

