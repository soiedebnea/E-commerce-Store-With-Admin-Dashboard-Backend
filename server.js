require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const travelRoutes = require("./routes/travelRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { stripeWebhook } = require("./controllers/paymentController");
const { router: uploadRoutes, uploadDir } = require("./routes/uploadRoutes");

connectDB();

const app = express();

// Behind Render/Heroku-style proxies, so req.protocol is "https" in production
app.set("trust proxy", 1);

// CLIENT_ORIGIN can hold several origins separated by commas
const origins = (process.env.CLIENT_ORIGIN || "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : "*" }));
app.use(morgan("dev"));

// Stripe needs the RAW body to verify its signature, so this route comes before express.json()
app.post("/api/payments/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: false })); // SSLCommerz posts form data back to us

app.get("/", (req, res) => {
  res.json({ message: "E-Commerce Store API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/travel", travelRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/uploads", express.static(uploadDir));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));