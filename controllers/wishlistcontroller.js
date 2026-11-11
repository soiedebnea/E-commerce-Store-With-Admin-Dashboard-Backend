const User = require("../models/User");

const getList = async (userId) => {
  const user = await User.findById(userId).populate({ path: "wishlist", match: { isActive: true } });
  return (user?.wishlist || []).filter(Boolean);
};

// GET /api/wishlist
exports.getWishlist = async (req, res, next) => {
  try { res.json({ wishlist: await getList(req.user._id) }); } catch (err) { next(err); }
};

// POST /api/wishlist/:productId
exports.addToWishlist = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: req.params.productId } });
    res.status(201).json({ wishlist: await getList(req.user._id) });
  } catch (err) { next(err); }
};

// DELETE /api/wishlist/:productId
exports.removeFromWishlist = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.productId } });
    res.json({ wishlist: await getList(req.user._id) });
  } catch (err) { next(err); }
};