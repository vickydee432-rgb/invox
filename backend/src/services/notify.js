const Notification = require("../models/Notification");
const { sendPushToUser } = require("./push");

async function createNotification({ companyId, userId, type, message, severity = "info", data } = {}) {
  if (!companyId || !userId) throw new Error("Missing companyId or userId");
  if (!type || !message) throw new Error("Missing type or message");
  return Notification.create({
    companyId,
    userId,
    type,
    message,
    severity,
    data: data || undefined,
    status: "unread",
    triggeredAt: new Date()
  });
}

async function createAndPushNotification({ companyId, userId, type, message, severity = "info", data, push } = {}) {
  const note = await createNotification({ companyId, userId, type, message, severity, data });
  if (push) {
    await sendPushToUser({
      companyId,
      userId,
      payload: {
        title: push.title || "Invox",
        body: push.body || message,
        url: push.url || "/notifications",
        tag: push.tag || type,
        severity
      }
    }).catch(() => {});
  }
  return note;
}

module.exports = {
  createNotification,
  createAndPushNotification
};

