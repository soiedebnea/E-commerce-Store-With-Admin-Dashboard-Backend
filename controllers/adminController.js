const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const [userCount, productCount, orders, lowStockProducts] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Product.countDocuments(),
      Order.find(),
      Product.countDocuments({ stock: { $lte: 5 } }),
    ]);

    const totalOrders = orders.length;
    const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
    const pendingOrders = orders.filter((o) => o.paymentStatus === "pending");
    const failedOrders = orders.filter((o) => o.paymentStatus === "failed");
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({
      userCount,
      productCount,
      lowStockProducts,
      totalOrders,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      failedOrders: failedOrders.length,
      totalRevenue,
    });
  } catch (err) {
    next(err);
  }
};