const Order = require("../models/Order");
const stripe = require("../services/payments/stripe");
const sslcommerz = require("../services/payments/sslcommerz");
const bkash = require("../services/payments/bkash");
const { markOrderPaid, markOrderFailed } = require("../services/orderService");
const { clientUrl, mockPaymentAllowed } = require("../config/urls");

const backToClient = (res, orderId, result) => res.redirect(`${clientUrl()}/payment/${orderId}?result=${result}`);

// GET /api/payments/config  -> which payment methods are available
exports.getConfig = (req, res) => {
  res.json({
    card: stripe.enabled(),
    sslcommerz: sslcommerz.enabled(),
    bkash: bkash.enabled(),
    cash_on_delivery: true,
    test_payment: mockPaymentAllowed(),
  });
};

const loadOwnOrder = async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) { res.status(404).json({ message: "Order not found" }); return null; }
  if (order.user.toString() !== req.user._id.toString()) { res.status(403).json({ message: "Not authorized for this order" }); return null; }
  return order;
};

// POST /api/payments/:orderId/start  -> returns { redirectUrl } | { paid } | { cod }
exports.startPayment = async (req, res, next) => {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    if (order.paymentStatus === "paid") return res.status(400).json({ message: "Order is already paid" });
    if (order.orderStatus === "cancelled") return res.status(400).json({ message: "Order was cancelled" });

    const a = order.shippingAddress || {};

    switch (order.paymentMethod) {
      case "card": {
        if (!stripe.enabled()) return res.status(400).json({ message: "Card payments are not configured" });
        const session = await stripe.createCheckoutSession(order);
        order.paymentProvider = "stripe";
        order.providerRef = session.id;
        order.paymentStatus = "pending";
        await order.save();
        return res.json({ redirectUrl: session.url });
      }
      case "sslcommerz": {
        if (!sslcommerz.enabled()) return res.status(400).json({ message: "SSLCommerz is not configured" });
        if (!a.phone) return res.status(400).json({ message: "A phone number is required for SSLCommerz" });
        const tranId = sslcommerz.newTranId(order);
        const url = await sslcommerz.initSession(order, tranId);
        order.paymentProvider = "sslcommerz";
        order.providerRef = tranId;
        order.paymentStatus = "pending";
        await order.save();
        return res.json({ redirectUrl: url });
      }
      case "bkash": {
        if (!bkash.enabled()) return res.status(400).json({ message: "bKash is not configured" });
        const { paymentID, bkashURL } = await bkash.createPayment(order);
        order.paymentProvider = "bkash";
        order.providerRef = paymentID;
        order.paymentStatus = "pending";
        await order.save();
        return res.json({ redirectUrl: bkashURL });
      }
      case "cash_on_delivery":
        return res.json({ cod: true });
      case "test_payment": {
        if (!mockPaymentAllowed()) return res.status(403).json({ message: "Test payments are disabled" });
        const paid = await markOrderPaid(order, { transactionId: `TEST-${Date.now()}`, provider: "test" });
        return res.json({ paid: true, order: paid });
      }
      default:
        return res.status(400).json({ message: "This payment method is no longer supported. Please place a new order." });
    }
  } catch (err) {
    res.status(502);
    next(new Error(`Payment provider error: ${err.message}`));
  }
};

// POST /api/payments/:orderId/confirm  -> after returning from Stripe, double-check the session
exports.confirmPayment = async (req, res, next) => {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    if (order.paymentStatus !== "paid" && order.paymentProvider === "stripe" && order.providerRef) {
      const session = await stripe.retrieveSession(order.providerRef);
      if (stripe.isSessionPaidForOrder(session, order)) {
        const paid = await markOrderPaid(order, { transactionId: String(session.payment_intent || session.id), provider: "stripe" });
        return res.json(paid);
      }
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// POST /api/payments/stripe/webhook  (raw body; mounted in server.js before express.json)
exports.stripeWebhook = async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripe.enabled()) return res.status(503).send("Stripe webhook is not configured");
  let event;
  try {
    event = stripe.constructEvent(req.body, req.headers["stripe-signature"], secret);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }
  try {
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      const session = event.data.object;
      const order = await Order.findById(session.metadata?.orderId || session.client_reference_id);
      if (order && stripe.isSessionPaidForOrder(session, order)) {
        await markOrderPaid(order, { transactionId: String(session.payment_intent || session.id), provider: "stripe" });
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handling failed:", err.message);
    res.status(500).send("Webhook handler failed");
  }
};

// ---------- SSLCommerz (browser POSTs here after payment; IPN POSTs server-to-server) ----------
const handleSslSuccess = async (body) => {
  const order = await Order.findOne({ providerRef: body.tran_id });
  if (!order) return { order: null, ok: false };
  if (order.paymentStatus === "paid") return { order, ok: true };
  if (!body.val_id || !["VALID", "VALIDATED"].includes(body.status)) return { order, ok: false };
  const v = await sslcommerz.validate(body.val_id);
  if (!sslcommerz.isValidForOrder(v, order, body.tran_id)) return { order, ok: false };
  await markOrderPaid(order, { transactionId: v.bank_tran_id || body.val_id, provider: "sslcommerz" });
  return { order, ok: true };
};

exports.sslSuccess = async (req, res) => {
  try {
    const { order, ok } = await handleSslSuccess(req.body || {});
    if (!order) return res.redirect(`${clientUrl()}/orders`);
    if (!ok) await markOrderFailed(order);
    return backToClient(res, order._id, ok ? "success" : "failed");
  } catch (err) {
    console.error("SSLCommerz success handler:", err.message);
    res.redirect(`${clientUrl()}/orders`);
  }
};

exports.sslIpn = async (req, res) => {
  try {
    await handleSslSuccess(req.body || {});
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send("error");
  }
};

exports.sslFail = async (req, res) => {
  const order = await Order.findOne({ providerRef: (req.body || {}).tran_id }).catch(() => null);
  if (!order) return res.redirect(`${clientUrl()}/orders`);
  await markOrderFailed(order);
  backToClient(res, order._id, "failed");
};

exports.sslCancel = async (req, res) => {
  const order = await Order.findOne({ providerRef: (req.body || {}).tran_id }).catch(() => null);
  if (!order) return res.redirect(`${clientUrl()}/orders`);
  backToClient(res, order._id, "cancelled");
};

// ---------- bKash (browser is redirected here with ?paymentID=&status=success|failure|cancel) ----------
exports.bkashCallback = async (req, res) => {
  const { paymentID, status, orderId } = req.query;
  try {
    const order = await Order.findById(orderId);
    if (!order || !paymentID || order.providerRef !== paymentID) return res.redirect(`${clientUrl()}/orders`);
    if (order.paymentStatus === "paid") return backToClient(res, order._id, "success");
    if (status === "cancel") return backToClient(res, order._id, "cancelled");
    if (status !== "success") { await markOrderFailed(order); return backToClient(res, order._id, "failed"); }

    const result = await bkash.executePayment(paymentID);
    if (bkash.isCompletedForOrder(result, order)) {
      await markOrderPaid(order, { transactionId: result.trxID, provider: "bkash" });
      return backToClient(res, order._id, "success");
    }
    await markOrderFailed(order);
    backToClient(res, order._id, "failed");
  } catch (err) {
    console.error("bKash callback:", err.message);
    res.redirect(`${clientUrl()}/orders`);
  }
};