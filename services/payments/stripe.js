const Stripe = require("stripe");
const { clientUrl } = require("../../config/urls");

const enabled = () => !!process.env.STRIPE_SECRET_KEY;
const currency = () => (process.env.STRIPE_CURRENCY || "usd").toLowerCase();

let client;
const getClient = () => client || (client = new Stripe(process.env.STRIPE_SECRET_KEY));
const _setClient = (c) => { client = c; }; // used by tests

// Amount in the smallest currency unit, computed from the items (same math used for the check later)
const expectedAmount = (order) => order.items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0);

const createCheckoutSession = (order) =>
  getClient().checkout.sessions.create({
    mode: "payment",
    customer_email: order.contactEmail,
    client_reference_id: String(order._id),
    metadata: { orderId: String(order._id) },
    line_items: order.items.map((i) => ({
      quantity: i.quantity,
      price_data: { currency: currency(), unit_amount: Math.round(i.price * 100), product_data: { name: i.name } },
    })),
    success_url: `${clientUrl()}/payment/${order._id}?result=success`,
    cancel_url: `${clientUrl()}/payment/${order._id}?result=cancelled`,
  });

const retrieveSession = (id) => getClient().checkout.sessions.retrieve(id);

const constructEvent = (rawBody, signature, secret) => getClient().webhooks.constructEvent(rawBody, signature, secret);

// True only if Stripe says it is paid AND the amount/currency match our order
const isSessionPaidForOrder = (session, order) =>
  session.payment_status === "paid" &&
  session.amount_total === expectedAmount(order) &&
  String(session.currency).toLowerCase() === currency();

module.exports = { enabled, createCheckoutSession, retrieveSession, constructEvent, isSessionPaidForOrder, expectedAmount, _setClient };