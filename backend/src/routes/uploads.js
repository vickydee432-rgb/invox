const express = require("express");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");

const MAX_FILE_SIZE = Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf"
]);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    return cb(null, true);
  }
});

const router = express.Router();

router.post("/receipt", requireAuth, requireSubscription, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  res.json({
    ok: true,
    file: {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    },
    note: "Upload accepted. Store file in your object storage (S3/R2) and save the URL."
  });
});

router.use((err, req, res, next) => {
  if (err?.message === "Unsupported file type") return res.status(400).json({ error: err.message });
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large" });
  }
  return next(err);
});

module.exports = router;
