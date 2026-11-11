const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed"));
  },
});

// POST /api/upload  (admin) - multipart field name: "image"
router.post("/", protect, adminOnly, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(err);
    }
    if (!req.file) return res.status(400).json({ message: "No image file received" });
    const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  });
});

module.exports = { router, upload, uploadDir };