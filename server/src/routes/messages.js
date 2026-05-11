const router = require("express").Router();
const Message = require("../models/Message");

// GET /api/messages?room=general&limit=100
router.get("/", async (req, res) => {
  try {
    const { room } = req.query;
    const limit = Number(req.query.limit || 100);

    if (!room) return res.status(400).json({ message: "room is required" });

    const msgs = await Message.find({ room })
      .sort({ createdAt: 1 })
      .limit(limit);

    res.json(msgs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;