const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "fallback_secret", { expiresIn: "30d" });
};

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ message: "Name, phone, and password are required" });
    }

    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: "User with this phone already exists" });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, phone, passwordHash });
    
    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    
    // Find by phone or email
    const query = phone ? { phone } : { email };
    const user = await User.findOne(query);

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  res.json({
    _id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    phone: req.user.phone
  });
});

module.exports = router;
