const strip = (u) => (u || "").trim().replace(/\/$/, "");

// First entry of CLIENT_ORIGIN (it may hold several comma-separated origins)
exports.clientUrl = () => strip((process.env.CLIENT_ORIGIN || "").split(",")[0]) || "http://localhost:5173";

// Public URL of THIS backend (used for gateway callbacks)
exports.serverUrl = () => strip(process.env.SERVER_URL) || `http://localhost:${process.env.PORT || 5000}`;

// Test/demo payment is allowed unless explicitly disabled or running in production
exports.mockPaymentAllowed = () => {
  const v = process.env.PAYMENT_ALLOW_MOCK;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
};