const express = require("express");
const router = express.Router();
const c = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");

router.get("/config", c.getConfig);

// Gateway callbacks (no login - these are called by the gateway / the browser coming back from it)
router.post("/sslcommerz/success", c.sslSuccess);
router.post("/sslcommerz/fail", c.sslFail);
router.post("/sslcommerz/cancel", c.sslCancel);
router.post("/sslcommerz/ipn", c.sslIpn);
router.get("/bkash/callback", c.bkashCallback);

router.post("/:orderId/start", protect, c.startPayment);
router.post("/:orderId/confirm", protect, c.confirmPayment);

module.exports = router;