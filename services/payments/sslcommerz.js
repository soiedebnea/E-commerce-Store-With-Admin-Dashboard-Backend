const { serverUrl } = require("../../config/urls");

const enabled = () => !!(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD);
const base = () => (process.env.SSLCOMMERZ_IS_LIVE === "true" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com");
const currency = () => (process.env.SSLCOMMERZ_CURRENCY || "BDT").toUpperCase();

// Store prices are in USD. For BDT we convert with USD_TO_BDT_RATE (set it to today's rate!).
const toGatewayAmount = (usd) => {
  const rate = currency() === "BDT" ? Number(process.env.USD_TO_BDT_RATE || 122) : 1;
  return Number((usd * rate).toFixed(2));
};

// tran_id must be unique and <= 30 chars; we map it back to the order via order.providerRef
const newTranId = (order) => `${String(order._id).slice(-12)}${Date.now().toString(36)}`;

const initSession = async (order, tranId) => {
  const a = order.shippingAddress || {};
  const body = new URLSearchParams({
    store_id: process.env.SSLCOMMERZ_STORE_ID,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD,
    total_amount: String(toGatewayAmount(order.totalAmount)),
    currency: currency(),
    tran_id: tranId,
    success_url: `${serverUrl()}/api/payments/sslcommerz/success`,
    fail_url: `${serverUrl()}/api/payments/sslcommerz/fail`,
    cancel_url: `${serverUrl()}/api/payments/sslcommerz/cancel`,
    ipn_url: `${serverUrl()}/api/payments/sslcommerz/ipn`,
    shipping_method: "Courier",
    product_name: order.items.map((i) => i.name).join(", ").slice(0, 250),
    product_category: "General",
    product_profile: "general",
    cus_name: a.fullName || "Customer",
    cus_email: order.contactEmail,
    cus_add1: a.addressLine || "N/A",
    cus_city: a.city || "N/A",
    cus_postcode: a.postalCode || "0000",
    cus_country: a.country || "N/A",
    cus_phone: a.phone || "N/A",
    ship_name: a.fullName || "Customer",
    ship_add1: a.addressLine || "N/A",
    ship_city: a.city || "N/A",
    ship_postcode: a.postalCode || "0000",
    ship_country: a.country || "N/A",
    value_a: String(order._id),
  });
  const res = await fetch(`${base()}/gwprocess/v4/api.php`, { method: "POST", body });
  const data = await res.json();
  if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
    throw new Error(data.failedreason || "SSLCommerz could not start the payment");
  }
  return data.GatewayPageURL;
};

// Server-to-server check of a val_id. Never trust the browser POST by itself.
const validate = async (valId) => {
  const qs = new URLSearchParams({
    val_id: valId,
    store_id: process.env.SSLCOMMERZ_STORE_ID,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD,
    format: "json",
  });
  const res = await fetch(`${base()}/validator/api/validationserverAPI.php?${qs}`);
  return res.json();
};

// Does the validation result match our order (status, transaction id, amount)?
const isValidForOrder = (v, order, tranId) => {
  if (!v || !["VALID", "VALIDATED"].includes(v.status)) return false;
  if (v.tran_id !== tranId) return false;
  const paid = Number(currency() === "BDT" ? v.amount : v.currency_amount || v.amount);
  return Math.abs(paid - toGatewayAmount(order.totalAmount)) < 0.01;
};

module.exports = { enabled, newTranId, initSession, validate, isValidForOrder, toGatewayAmount };