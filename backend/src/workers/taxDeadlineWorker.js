const Company = require("../models/Company");
const User = require("../models/User");
const TaxDeadline = require("../models/TaxDeadline");
const Notification = require("../models/Notification");
const { ensureTaxDeadlinesForCompany, startOfDay, addDays } = require("../services/taxDeadlines");
const { sendMail } = require("../services/email");

let intervalId = null;
let isRunning = false;

function getIntervalMs() {
  const raw = process.env.TAX_DEADLINE_WORKER_INTERVAL_MS || String(24 * 60 * 60 * 1000);
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 60 * 1000 ? ms : 24 * 60 * 60 * 1000;
}

function daysBetween(a, b) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / oneDay);
}

function buildMessage(deadline, daysUntil) {
  const due = deadline.dueDate ? new Date(deadline.dueDate) : null;
  const dueLabel = due ? due.toLocaleDateString() : "—";
  if (daysUntil < 0) return `Overdue: ${deadline.title} (due ${dueLabel})`;
  if (daysUntil === 0) return `Due today: ${deadline.title} (due ${dueLabel})`;
  return `Upcoming: ${deadline.title} (due ${dueLabel}, in ${daysUntil} days)`;
}

function severityFor(daysUntil) {
  if (daysUntil < 0 || daysUntil === 0) return "danger";
  if (daysUntil <= 7) return "warning";
  return "info";
}

async function notifyUsersForDeadline(companyId, deadline, daysUntil, daysBeforeKey) {
  if (deadline?.channels?.inApp === false) return;
  const users = await User.find({ companyId }).select("_id email").lean();
  if (!users.length) return;
  const message = buildMessage(deadline, daysUntil);
  const severity = severityFor(daysUntil);
  const data = {
    deadlineId: String(deadline._id),
    taxType: deadline.taxType,
    dueDate: deadline.dueDate,
    daysBefore: daysBeforeKey
  };
  for (const u of users) {
    try {
      const query = {
        companyId,
        userId: u._id,
        type: "tax_deadline",
        "data.deadlineId": data.deadlineId,
        "data.daysBefore": daysBeforeKey
      };
      const existing = await Notification.findOne(query).select("data").lean();
      const emailAlreadySent = Boolean(existing?.data?.emailSent);

      const note = await Notification.findOneAndUpdate(
        query,
        {
          $set: { message, severity, status: "unread", triggeredAt: new Date(), data: { ...data, emailSent: existing?.data?.emailSent } },
          $setOnInsert: { companyId, userId: u._id, type: "tax_deadline" }
        },
        { upsert: true, new: true }
      );

      if (
        deadline?.channels?.email &&
        !emailAlreadySent &&
        daysBeforeKey >= 0 &&
        u.email &&
        typeof u.email === "string"
      ) {
        const subject = `Tax reminder: ${deadline.title}`;
        const text = message;
        const html = `<p>${message}</p>`;
        await sendMail({ to: u.email, subject, text, html }).catch(() => {});
        await Notification.updateOne({ _id: note._id }, { $set: { "data.emailSent": true, "data.emailSentAt": new Date() } }).catch(
          () => {}
        );
      }
    } catch (err) {
      // ignore duplicates via unique sparse index
    }
  }
}

async function tick() {
  if (isRunning) return;
  isRunning = true;
  try {
    const companies = await Company.find({}).select("_id").lean();
    const now = new Date();
    const today = startOfDay(now);
    const maxLookahead = addDays(today, 35);

    for (const company of companies) {
      const companyId = company._id;
      const workspaceId = String(companyId);
      await ensureTaxDeadlinesForCompany(companyId, workspaceId);

      const deadlines = await TaxDeadline.find({
        companyId,
        status: { $in: ["pending"] },
        dueDate: { $lte: maxLookahead }
      })
        .sort({ dueDate: 1 })
        .lean();

      for (const deadline of deadlines) {
        const due = new Date(deadline.dueDate);
        const daysUntil = daysBetween(today, due);
        const notifyDays = Array.isArray(deadline.notifyDaysBefore) && deadline.notifyDaysBefore.length
          ? deadline.notifyDaysBefore
          : [];

        if (daysUntil < 0) {
          await notifyUsersForDeadline(companyId, deadline, daysUntil, -1);
          continue;
        }

        if (notifyDays.includes(daysUntil)) {
          await notifyUsersForDeadline(companyId, deadline, daysUntil, daysUntil);
        }
      }
    }
  } finally {
    isRunning = false;
  }
}

function startTaxDeadlineWorker() {
  if (process.env.TAX_DEADLINE_WORKER_ENABLED === "false") return;
  const intervalMs = getIntervalMs();
  tick();
  intervalId = setInterval(tick, intervalMs);
}

function stopTaxDeadlineWorker() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = { startTaxDeadlineWorker, stopTaxDeadlineWorker };
