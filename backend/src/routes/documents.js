const express = require("express");
const { z } = require("zod");
const DocumentFile = require("../models/DocumentFile");
const DocumentLink = require("../models/DocumentLink");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { ensureObjectId, handleRouteError } = require("./_helpers");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("documents"));

const FileSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  mime: z.string().optional(),
  size: z.number().optional(),
  tags: z.array(z.string()).optional()
});

router.post("/files", async (req, res) => {
  try {
    const parsed = FileSchema.parse(req.body);
    const file = await DocumentFile.create({
      companyId: req.user.companyId,
      fileName: parsed.fileName,
      fileUrl: parsed.fileUrl,
      mime: parsed.mime,
      size: parsed.size || 0,
      tags: parsed.tags || []
    });
    res.status(201).json({ file });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create file record");
  }
});

const LinkSchema = z.object({
  fileId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1)
});

router.post("/document-links", async (req, res) => {
  try {
    const parsed = LinkSchema.parse(req.body);
    ensureObjectId(parsed.fileId, "file id");
    ensureObjectId(parsed.entityId, "entity id");
    const link = await DocumentLink.create({
      companyId: req.user.companyId,
      fileId: parsed.fileId,
      entityType: parsed.entityType,
      entityId: parsed.entityId
    });
    res.status(201).json({ link });
  } catch (err) {
    return handleRouteError(res, err, "Failed to link document");
  }
});

module.exports = router;
