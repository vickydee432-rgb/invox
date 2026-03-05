const express = require("express");
const { z } = require("zod");
const Device = require("../models/Device");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { handleRouteError } = require("./_helpers");

const router = express.Router();
router.use(requireAuth, requireSubscription);

const RegisterSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string().optional(),
  platform: z.string().optional()
});

router.post("/register", async (req, res) => {
  try {
    const parsed = RegisterSchema.parse(req.body);
    const device = await Device.findOneAndUpdate(
      { companyId: req.user.companyId, deviceId: parsed.deviceId },
      {
        $set: {
          userId: req.user._id,
          name: parsed.name,
          platform: parsed.platform,
          lastSeenAt: new Date()
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ deviceId: device.deviceId });
  } catch (err) {
    return handleRouteError(res, err, "Failed to register device");
  }
});

module.exports = router;
