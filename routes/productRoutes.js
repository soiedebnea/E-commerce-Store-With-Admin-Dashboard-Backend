const express = require("express");
const router = express.Router();
const {
  getProducts,
  getCategories,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { getReviews, createReview, deleteReview } = require("../controllers/reviewController");
const { protect, adminOnly } = require("../middleware/auth");

router.get("/", getProducts);
router.get("/categories", getCategories);
router.get("/:id/reviews", getReviews);
router.post("/:id/reviews", protect, createReview);
router.delete("/:id/reviews/:reviewId", protect, deleteReview);
router.get("/:id", getProductById);
router.post("/", protect, adminOnly, createProduct);
router.put("/:id", protect, adminOnly, updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

module.exports = router;