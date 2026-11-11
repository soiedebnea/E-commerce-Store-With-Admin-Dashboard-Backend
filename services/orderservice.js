const Order = require("../models/Order");
const Product = require("../models/Product");
const { sendOrderEmail } = require("./email");

// Marks an order paid exactly once (safe if a webhook and a browser callback both arrive).
exports.markOrderPaid = async (order, { transactionId, provider }) => {
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "paid", orderStatus: "confirmed", transactionId, paymentProvider: provider } },
    { new: true }
  );
  if (!updated) return Order.findById(order._id); // already paid by another request
  sendOrderEmail(updated, "paid").catch(() => {});
  return updated;
};

exports.markOrderFailed = async (order) => {
  return Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $nin: ["paid", "refunded"] } },
    { $set: { paymentStatus: "failed" } },
    { new: true }
  );
};

// Give seats/stock back when an order is cancelled
exports.restoreStock = async (order) => {
  for (const item of order.items) {
    await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
  }
};