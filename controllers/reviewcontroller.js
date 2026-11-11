const mongoose = require("mongoose");
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

const recalc = async (productId) => {
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.findByIdAndUpdate(productId, {
    ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0,
    ratingCount: agg ? agg.count : 0,
  });
};

// GET /api/products/:id/reviews
exports.getReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.id }).populate("user", "name").sort({ createdAt: -1 });
    const count = reviews.length;
    const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    res.json({ reviews, average, count });
  } catch (err) { next(err); }
};

// POST /api/products/:id/reviews  { rating, comment }  (adds, or updates the user's existing review)
exports.createReview = async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be a whole number from 1 to 5" });
    }
    const product = await Product.findById(req.params.id);
    if (!product || product.kind !== "product") return res.status(404).json({ message: "Product not found" });

    const verified = !!(await Order.exists({ user: req.user._id, paymentStatus: "paid", "items.product": product._id }));
    const review = await Review.findOneAndUpdate(
      { product: product._id, user: req.user._id },
      { rating, comment: req.body.comment || "", verifiedPurchase: verified },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    await recalc(product._id);
    res.status(201).json(review);
  } catch (err) { next(err); }
};

// DELETE /api/products/:id/reviews/:reviewId  (owner or admin)
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findOne({ _id: req.params.reviewId, product: req.params.id });
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not allowed to delete this review" });
    }
    await review.deleteOne();
    await recalc(req.params.id);
    res.json({ message: "Review deleted" });
  } catch (err) { next(err); }
};