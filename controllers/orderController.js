const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { sendOrderEmail } = require("../services/email");
const { restoreStock } = require("../services/orderService");

const METHODS = ["card", "sslcommerz", "bkash", "cash_on_delivery", "test_payment"];

// POST /api/orders  { paymentMethod, contactEmail, shippingAddress }
// Creates an order from the user's current cart, with paymentStatus "pending"
exports.createOrder = async (req, res, next) => {
  try {
    const { paymentMethod, contactEmail, shippingAddress } = req.body;
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    if (!shippingAddress) {
      return res.status(400).json({ message: "shippingAddress is required" });
    }
    const method = paymentMethod || "card";
    if (!METHODS.includes(method)) {
      return res.status(400).json({ message: "Unsupported payment method" });
    }

    const items = [];
    let totalAmount = 0;

    for (const item of cart.items) {
      const product = item.product;
      if (!product) continue;
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${product.name}` });
      }
      items.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
      });
      totalAmount += product.price * item.quantity;
    }

    const order = await Order.create({
      user: req.user._id,
      items,
      totalAmount,
      paymentMethod: method,
      contactEmail: contactEmail || req.user.email,
      shippingAddress,
      paymentStatus: "pending",
      orderStatus: method === "cash_on_delivery" ? "confirmed" : "processing",
    });

    // decrement stock
    for (const item of cart.items) {
      if (item.product) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { stock: -item.quantity },
        });
      }
    }

    cart.items = [];
    await cart.save();

    if (method === "cash_on_delivery") sendOrderEmail(order, "cod").catch(() => {});

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/my
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// GET /api/orders (admin - all orders)
exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().populate("user", "name email").sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

// PUT /api/orders/:id/status (admin) { orderStatus, paymentStatus }
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const previous = order.orderStatus;
    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    await order.save();

    if (orderStatus && orderStatus !== previous) {
      if (orderStatus === "cancelled") await restoreStock(order);
      if (["shipped", "delivered", "cancelled"].includes(orderStatus)) sendOrderEmail(order, orderStatus).catch(() => {});
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
};