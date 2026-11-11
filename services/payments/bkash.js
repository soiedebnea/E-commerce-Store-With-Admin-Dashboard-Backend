const { serverUrl } = require("../../config/urls");

const enabled = () => !!(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET && process.env.BKASH_USERNAME && process.env.BKASH_PASSWORD);
const base = () =>
  process.env.BKASH_IS_LIVE === "true"
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized";

// bKash only accepts BDT. Store prices are USD, converted with USD_TO_BDT_RATE.
const toBdt = (usd) => Number((usd * Number(process.env.USD_TO_BDT_RATE || 122)).toFixed(2));

let tokenCache = { idToken: null, expiresAt: 0 };

const getToken = async () => {
  if (tokenCache.idToken && Date.now() < tokenCache.expiresAt) return tokenCache.idToken;
  const res = await fetch(`${base()}/checkout/token/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", username: process.env.BKASH_USERNAME, password: process.env.BKASH_PASSWORD },
    body: JSON.stringify({ app_key: process.env.BKASH_APP_KEY, app_secret: process.env.BKASH_APP_SECRET }),
  });
  const data = await res.json();
  if (!data.id_token) throw new Error(data.statusMessage || "bKash authentication failed");
  tokenCache = { idToken: data.id_token, expiresAt: Date.now() + Math.max((Number(data.expires_in) || 3600) - 120, 60) * 1000 };
  return tokenCache.idToken;
};

const call = async (path, payload) => {
  const token = await getToken();
  const res = await fetch(`${base()}/checkout/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: token, "X-APP-Key": process.env.BKASH_APP_KEY },
    body: JSON.stringify(payload),
  });
  return res.json();
};

const createPayment = async (order) => {
  const data = await call("create", {
    mode: "0011",
    payerReference: order.contactEmail || String(order.user),
    callbackURL: `${serverUrl()}/api/payments/bkash/callback?orderId=${order._id}`,
    amount: toBdt(order.totalAmount).toFixed(2),
    currency: "BDT",
    intent: "sale",
    merchantInvoiceNumber: String(order._id),
  });
  if (!data.bkashURL || !data.paymentID) throw new Error(data.statusMessage || "bKash could not start the payment");
  return { paymentID: data.paymentID, bkashURL: data.bkashURL };
};

const executePayment = (paymentID) => call("execute", { paymentID });

const isCompletedForOrder = (r, order) =>
  r &&
  r.transactionStatus === "Completed" &&
  r.merchantInvoiceNumber === String(order._id) &&
  Math.abs(Number(r.amount) - toBdt(order.totalAmount)) < 0.01;

module.exports = { enabled, createPayment, executePayment, isCompletedForOrder, toBdt };