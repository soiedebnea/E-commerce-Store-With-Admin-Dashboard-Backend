const express = require("express");
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
} = require("../controllers/orderController");
const { protect, adminOnly } = require("../middleware/auth");

router.use(protect);
router.post("/", createOrder);
router.get("/my", getMyOrders);
router.get("/", adminOnly, getAllOrders);
router.get("/:id", getOrderById);
router.put("/:id/status", adminOnly, updateOrderStatus);

module.exports = router;