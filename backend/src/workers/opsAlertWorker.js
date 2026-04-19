const Company = require("../models/Company");
const User = require("../models/User");
const Branch = require("../models/Branch");
const Invoice = require("../models/Invoice");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const Notification = require("../models/Notification");
const { createAndPushNotification } = require("../services/notify");

let intervalId = null;
let isRunning = false;

function getIntervalMs() {
  const raw = process.env.OPS_ALERT_WORKER_INTERVAL_MS || String(60 * 60 * 1000);
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 60 * 1000 ? ms : 60 * 60 * 1000;
}

function hoursToMs(hours, fallbackHours) {
  const n = Number(hours);
  const h = Number.isFinite(n) && n > 0 ? n : fallbackHours;
  return h * 60 * 60 * 1000;
}

function daysToMs(days, fallbackDays) {
  const n = Number(days);
  const d = Number.isFinite(n) && n > 0 ? n : fallbackDays;
  return d * 24 * 60 * 60 * 1000;
}

async function listRecipients(companyId) {
  const users = await User.find({ companyId, role: { $in: ["owner", "admin"] } }).select("_id").lean();
  return users.map((u) => String(u._id));
}

async function wasSentRecently({ companyId, userId, type, dedupeKey, cooldownMs }) {
  const since = new Date(Date.now() - cooldownMs);
  const existing = await Notification.findOne({
    companyId,
    userId,
    type,
    "data.dedupeKey": dedupeKey,
    triggeredAt: { $gte: since }
  })
    .select("_id")
    .lean();
  return Boolean(existing?._id);
}

async function notifyRecipients({ companyId, userIds, type, message, severity, data, push }) {
  const cooldownMs = hoursToMs(process.env.OPS_ALERT_COOLDOWN_HOURS, 24);
  for (const userId of userIds) {
    const dedupeKey = String(data?.dedupeKey || `${type}:${message}`);
    const skip = await wasSentRecently({ companyId, userId, type, dedupeKey, cooldownMs }).catch(() => false);
    if (skip) continue;
    await createAndPushNotification({
      companyId,
      userId,
      type,
      message,
      severity,
      data: { ...(data || {}), dedupeKey },
      push
    }).catch(() => {});
  }
}

async function checkLowStock(company) {
  const companyId = company._id;
  const userIds = await listRecipients(companyId);
  if (!userIds.length) return;

  const branchIds = await Branch.find({ companyId, isActive: true }).select("_id name").lean();
  if (!branchIds.length) return;
  const branchNameById = new Map(branchIds.map((b) => [String(b._id), b.name]));

  const lowStocks = await Stock.aggregate([
    { $match: { companyId } },
    {
      $lookup: {
        from: Product.collection.name,
        localField: "productId",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    { $match: { "product.isActive": { $ne: false }, "product.reorderLevel": { $gt: 0 } } },
    {
      $project: {
        branchId: 1,
        productId: 1,
        onHand: 1,
        reorderLevel: "$product.reorderLevel",
        productName: "$product.name"
      }
    },
    { $match: { $expr: { $lte: ["$onHand", "$reorderLevel"] } } },
    { $sort: { onHand: 1 } },
    { $limit: 25 }
  ]);

  for (const row of lowStocks) {
    const branchId = row.branchId ? String(row.branchId) : "";
    if (!branchId || !branchNameById.has(branchId)) continue;
    const productId = row.productId ? String(row.productId) : "";
    const message = `Low stock: ${row.productName || "Item"} at ${branchNameById.get(branchId)} (on hand ${Number(row.onHand || 0)}, reorder ${Number(row.reorderLevel || 0)}).`;
    const type = "low_stock";
    const severity = "warning";
    const dedupeKey = `${type}:${branchId}:${productId}`;
    await notifyRecipients({
      companyId,
      userIds,
      type,
      message,
      severity,
      data: { branchId, productId, onHand: row.onHand, reorderLevel: row.reorderLevel, dedupeKey },
      push: { title: "Low stock", body: message, url: "/notifications", tag: dedupeKey }
    });
  }
}

async function checkBranchInactivity(company) {
  const companyId = company._id;
  const userIds = await listRecipients(companyId);
  if (!userIds.length) return;

  const inactivityDays = Number(process.env.OPS_ALERT_INACTIVITY_DAYS || 7);
  const cutoff = new Date(Date.now() - daysToMs(inactivityDays, 7));

  const branches = await Branch.find({ companyId, isActive: true }).select("_id name code").lean();
  if (!branches.length) return;
  const lastInvoiceByBranch = new Map(
    (
      await Invoice.aggregate([
        { $match: { companyId, status: { $ne: "cancelled" } } },
        { $group: { _id: "$branchId", last: { $max: "$issueDate" } } }
      ])
    )
      .filter((row) => row._id)
      .map((row) => [String(row._id), row.last])
  );

  for (const b of branches) {
    const last = lastInvoiceByBranch.get(String(b._id)) || null;
    if (last && new Date(last) > cutoff) continue;
    const message = `Branch inactive: ${b.name}${b.code ? ` (${b.code})` : ""} has no invoices in the last ${inactivityDays} day(s).`;
    const type = "branch_inactivity";
    const severity = "warning";
    const dedupeKey = `${type}:${String(b._id)}:${inactivityDays}`;
    await notifyRecipients({
      companyId,
      userIds,
      type,
      message,
      severity,
      data: { branchId: String(b._id), lastInvoiceAt: last, inactivityDays, dedupeKey },
      push: { title: "Branch inactive", body: message, url: "/notifications", tag: dedupeKey }
    });
  }
}

async function checkSalesDrop(company) {
  const companyId = company._id;
  const userIds = await listRecipients(companyId);
  if (!userIds.length) return;

  const windowDays = Number(process.env.OPS_ALERT_SALES_WINDOW_DAYS || 7);
  const thresholdPct = Number(process.env.OPS_ALERT_SALES_DROP_PCT || 20);
  if (!Number.isFinite(thresholdPct) || thresholdPct <= 0) return;

  const now = new Date();
  const startCurrent = new Date(now.getTime() - daysToMs(windowDays, 7));
  const startPrevious = new Date(now.getTime() - daysToMs(windowDays * 2, 14));

  const branchById = new Map(
    (await Branch.find({ companyId, isActive: true }).select("_id name").lean()).map((b) => [String(b._id), b.name])
  );

  const rows = await Invoice.aggregate([
    {
      $match: {
        companyId,
        status: { $ne: "cancelled" },
        branchId: { $ne: null },
        issueDate: { $gte: startPrevious, $lte: now }
      }
    },
    {
      $group: {
        _id: "$branchId",
        current: {
          $sum: {
            $cond: [{ $gte: ["$issueDate", startCurrent] }, "$total", 0]
          }
        },
        previous: {
          $sum: {
            $cond: [{ $lt: ["$issueDate", startCurrent] }, "$total", 0]
          }
        }
      }
    }
  ]);

  for (const r of rows) {
    const branchId = r._id ? String(r._id) : "";
    if (!branchId || !branchById.has(branchId)) continue;
    const previous = Number(r.previous || 0);
    const current = Number(r.current || 0);
    if (previous <= 0) continue;
    const drop = ((previous - current) / previous) * 100;
    if (drop < thresholdPct) continue;

    const message = `Sales drop: ${branchById.get(branchId)} is down ${drop.toFixed(0)}% (${previous.toFixed(0)} → ${current.toFixed(0)}) vs previous ${windowDays} days.`;
    const type = "sales_drop";
    const severity = "warning";
    const dedupeKey = `${type}:${branchId}:${windowDays}:${thresholdPct}`;
    await notifyRecipients({
      companyId,
      userIds,
      type,
      message,
      severity,
      data: { branchId, previous, current, drop: Number(drop.toFixed(1)), windowDays, thresholdPct, dedupeKey },
      push: { title: "Sales drop", body: message, url: "/notifications", tag: dedupeKey }
    });
  }
}

async function tick() {
  if (isRunning) return;
  isRunning = true;
  try {
    const companies = await Company.find({}).select("_id enabledModules inventoryEnabled").lean();
    for (const company of companies) {
      const hasNotifications = Array.isArray(company.enabledModules) && company.enabledModules.includes("notifications");
      const shouldRun = hasNotifications || String(process.env.OPS_ALERT_RUN_WITHOUT_NOTIFICATIONS || "") === "true";
      if (!shouldRun) continue;

      await checkBranchInactivity(company);
      await checkSalesDrop(company);
      const hasInventory = Boolean(company.inventoryEnabled) || (Array.isArray(company.enabledModules) && company.enabledModules.includes("inventory"));
      if (hasInventory) {
        await checkLowStock(company);
      }
    }
  } finally {
    isRunning = false;
  }
}

function startOpsAlertWorker() {
  if (process.env.OPS_ALERT_WORKER_ENABLED === "false") return;
  const intervalMs = getIntervalMs();
  tick();
  intervalId = setInterval(tick, intervalMs);
}

function stopOpsAlertWorker() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = { startOpsAlertWorker, stopOpsAlertWorker };

