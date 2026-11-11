const mongoose = require("mongoose");

/**
 * One collection for everything sold in the store.
 *  - kind "product": a normal shop item
 *  - kind "ticket" : an airline / bus / train ticket (uses the travel fields below)
 * For tickets, `stock` = seats available, so cart/checkout/payment work unchanged.
 */
const productSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "ticket"], default: "product", index: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },

    stock: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String, default: "" },
    brand: { type: String, default: "" },
    isActive: { type: Boolean, default: true },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // ---- ticket-only fields ----
    country: { type: mongoose.Schema.Types.ObjectId, ref: "Country" },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    mode: { type: String, enum: ["airline", "bus", "train"] },
    from: { type: String, trim: true },
    to: { type: String, trim: true },
    departureTime: { type: String },
    arrivalTime: { type: String },
    travelClass: { type: String },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text", category: "text" });
productSchema.index({ kind: 1, company: 1 });

module.exports = mongoose.model("Product", productSchema);