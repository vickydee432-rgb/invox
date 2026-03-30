const mongoose = require("mongoose");
const PhoneInventoryItem = require("../models/PhoneInventoryItem");

function extractPhoneItemIds(items) {
  const list = Array.isArray(items) ? items : [];
  const ids = list
    .map((it) => it?.phoneItemId)
    .filter(Boolean)
    .map((id) => String(id));
  return Array.from(new Set(ids));
}

async function markPhonesSold({ companyId, saleId, issueDate, phoneItemIds, session }) {
  return setPhonesForSale({
    companyId,
    saleId,
    issueDate,
    phoneItemIds,
    session,
    targetStatus: "sold"
  });
}

async function markPhonesReserved({ companyId, saleId, phoneItemIds, session }) {
  return setPhonesForSale({
    companyId,
    saleId,
    issueDate: null,
    phoneItemIds,
    session,
    targetStatus: "reserved"
  });
}

async function setPhonesForSale({ companyId, saleId, issueDate, phoneItemIds, session, targetStatus }) {
  if (!phoneItemIds.length) return;
  const ids = phoneItemIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const items = await PhoneInventoryItem.find({ _id: { $in: ids }, companyId, deletedAt: null }).session(session);
  if (items.length !== ids.length) {
    const err = new Error("One or more phone inventory items were not found");
    err.status = 400;
    throw err;
  }

  for (const item of items) {
    if (item.soldSaleId && String(item.soldSaleId) !== String(saleId)) {
      const err = new Error("Phone inventory item is reserved/sold on another sale");
      err.status = 409;
      throw err;
    }
    if (!["in_stock", "reserved", "sold", "returned", "in_repair"].includes(String(item.status || ""))) {
      const err = new Error("Phone inventory item cannot be updated in its current status");
      err.status = 400;
      throw err;
    }
    if (targetStatus === "sold" && item.status === "in_repair") {
      const err = new Error("Cannot sell a phone that is in repair");
      err.status = 400;
      throw err;
    }

    item.status = targetStatus;
    item.soldSaleId = saleId;
    item.soldAt = targetStatus === "sold" ? issueDate || new Date() : undefined;
    item.version = (item.version || 1) + 1;
    await item.save({ session });
  }
}

async function revertPhonesFromSale({ companyId, saleId, phoneItemIds, session }) {
  if (!phoneItemIds.length) return;
  const ids = phoneItemIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const items = await PhoneInventoryItem.find({
    _id: { $in: ids },
    companyId,
    deletedAt: null,
    soldSaleId: saleId
  }).session(session);
  for (const item of items) {
    item.status = "in_stock";
    item.soldAt = undefined;
    item.soldSaleId = null;
    item.version = (item.version || 1) + 1;
    await item.save({ session });
  }
}

async function syncPhoneInventoryForSale({ companyId, sale, previousSale, session }) {
  const nextIds = extractPhoneItemIds(sale?.items);
  const prevIds = extractPhoneItemIds(previousSale?.items);

  const nextSet = new Set(nextIds);
  const prevSet = new Set(prevIds);

  const removed = prevIds.filter((id) => !nextSet.has(id));
  const added = nextIds.filter((id) => !prevSet.has(id));

  const isCancelled = String(sale?.status) === "cancelled" || Boolean(sale?.deletedAt);
  const wasCancelled = String(previousSale?.status) === "cancelled" || Boolean(previousSale?.deletedAt);

  if (isCancelled) {
    await revertPhonesFromSale({ companyId, saleId: sale._id, phoneItemIds: prevIds, session });
    return;
  }

  const isPaid = String(sale?.status) === "paid";
  const wasPaid = String(previousSale?.status) === "paid";

  if (removed.length) {
    await revertPhonesFromSale({ companyId, saleId: sale._id, phoneItemIds: removed, session });
  }

  const nextTarget = isPaid ? "sold" : "reserved";
  if (added.length) {
    if (nextTarget === "sold") {
      await markPhonesSold({ companyId, saleId: sale._id, issueDate: sale.issueDate, phoneItemIds: added, session });
    } else {
      await markPhonesReserved({ companyId, saleId: sale._id, phoneItemIds: added, session });
    }
  }

  // Handle status transitions for phones that remained on the sale.
  if (nextIds.length > 0 && wasCancelled !== isCancelled) {
    // already covered by cancel/un-cancel branches; keep for clarity.
  }
  if (nextIds.length > 0 && wasPaid !== isPaid) {
    if (isPaid) {
      await markPhonesSold({ companyId, saleId: sale._id, issueDate: sale.issueDate, phoneItemIds: nextIds, session });
    } else {
      await markPhonesReserved({ companyId, saleId: sale._id, phoneItemIds: nextIds, session });
    }
  }
}

module.exports = { syncPhoneInventoryForSale, extractPhoneItemIds };
