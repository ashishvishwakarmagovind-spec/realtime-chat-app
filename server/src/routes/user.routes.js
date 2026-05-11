const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

// GET /api/users/search?q=
router.get("/search", protect, async (req, res) => {
  const keyword = req.query.q
    ? {
        $or: [
          { name: { $regex: req.query.q, $options: "i" } },
          { email: { $regex: req.query.q, $options: "i" } },
          { phone: { $regex: req.query.q, $options: "i" } },
        ],
      }
    : {};

  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } }).select("-passwordHash");
  res.json(users);
});

module.exports = router;
