const { runZraSync } = require("../services/zra/sync");

let intervalId = null;
let isRunning = false;

function getIntervalMs() {
  const raw = process.env.ZRA_SYNC_INTERVAL_MS || "300000";
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 10000 ? ms : 300000;
}

async function tick() {
  if (isRunning) return;
  isRunning = true;
  try {
    await runZraSync();
  } finally {
    isRunning = false;
  }
}

function startZraSyncWorker() {
  if (process.env.ZRA_SYNC_ENABLED === "false") return;
  const intervalMs = getIntervalMs();
  tick();
  intervalId = setInterval(tick, intervalMs);
}

function stopZraSyncWorker() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = { startZraSyncWorker, stopZraSyncWorker };
