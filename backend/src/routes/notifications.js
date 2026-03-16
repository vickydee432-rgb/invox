const express = require("express");
const { z } = require("zod");
const Notification = require("../models/Notification");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { handleRouteError } = require("./_helpers");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("notifications"));

router.get("/", async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const filter = {
      companyId: req.user.companyId,
      userId: req.user._id
    };
    if (status) filter.status = status;
    const notifications = await Notification.find(filter)
      .sort({ triggeredAt: -1 })
      .limit(50)
      .lean();
    res.json({ notifications });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load notifications");
  }
});

const NotificationSchema = z.object({
  type: z.string().min(1),
  message: z.string().min(1)
});

router.post("/", async (req, res) => {
  try {
    const parsed = NotificationSchema.parse(req.body);
    const notification = await Notification.create({
      companyId: req.user.companyId,
      userId: req.user._id,
      type: parsed.type,
      message: parsed.message,
      severity: "info"
    });
    res.status(201).json({ notification });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create notification");
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const parsed = z
      .object({ status: z.enum(["unread", "read", "dismissed"]) })
      .parse(req.body || {});
    const note = await Notification.findOne({ _id: req.params.id, companyId: req.user.companyId, userId: req.user._id });
    if (!note) return res.status(404).json({ error: "Notification not found" });
    note.status = parsed.status;
    await note.save();
    res.json({ notification: note });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update notification");
  }
});

module.exports = router;
