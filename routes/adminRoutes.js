const express = require("express");
const router = express.Router();
const { getStats } = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");

router.use(protect, adminOnly);
router.get("/stats", getStats);

module.exports = router;