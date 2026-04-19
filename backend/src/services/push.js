const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

function getVapidPublicKey() {
  return String(process.env.VAPID_PUBLIC_KEY || "").trim();
}

function getVapidPrivateKey() {
  return String(process.env.VAPID_PRIVATE_KEY || "").trim();
}

function isPushEnabled() {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!isPushEnabled()) return;
  const subject = String(process.env.VAPID_SUBJECT || "mailto:support@invox.local").trim();
  webpush.setVapidDetails(subject, getVapidPublicKey(), getVapidPrivateKey());
  configured = true;
}

async function sendToSubscriptions(subscriptions, payload) {
  ensureConfigured();
  if (!configured) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const body = JSON.stringify(payload || {});

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          expirationTime: sub.expirationTime || null,
          keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth }
        },
        body
      );
      sent += 1;
      await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
    } catch (err) {
      failed += 1;
      const statusCode = err?.statusCode || err?.status || null;
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
      }
    }
  }

  return { sent, failed };
}

async function sendPushToUser({ companyId, userId, payload }) {
  const subs = await PushSubscription.find({ companyId, userId }).sort({ updatedAt: -1 }).limit(20).lean();
  if (!subs.length) return { sent: 0, failed: 0 };
  return sendToSubscriptions(subs, payload);
}

async function sendPushToUsers({ companyId, userIds, payload }) {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  if (!ids.length) return { sent: 0, failed: 0 };
  const subs = await PushSubscription.find({ companyId, userId: { $in: ids } }).sort({ updatedAt: -1 }).limit(200).lean();
  if (!subs.length) return { sent: 0, failed: 0 };
  return sendToSubscriptions(subs, payload);
}

module.exports = {
  getVapidPublicKey,
  isPushEnabled,
  sendPushToUser,
  sendPushToUsers
};

