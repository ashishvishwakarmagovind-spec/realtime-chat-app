const express    = require("express");
const router     = express.Router();
const multer     = require("multer");
const path       = require("path");
const Message    = require("../models/Message");
const Conversation = require("../models/Conversation");
const { protect } = require("../middleware/authMiddleware");
const fs         = require("fs");

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

const populateMsg = (q) =>
  q.populate("senderId", "name phone email")
   .populate({ path: "replyTo", populate: { path: "senderId", select: "name" } });

// ── GET /api/messages/:conversationId ─────────────────────────────
router.get("/:conversationId", protect, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    if (!conv.members.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ message: "Not a member" });
    }
    const messages = await populateMsg(
      Message.find({ conversationId: req.params.conversationId }).sort({ createdAt: 1 })
    );
    res.json(messages);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/messages/:id  (edit) ─────────────────────────────────
router.put("/:id", protect, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: "Not found" });
    if (msg.senderId.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Forbidden" });
    msg.text     = req.body.text;
    msg.isEdited = true;
    await msg.save();
    const full = await populateMsg(Message.findById(msg._id));
    res.json(full);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/messages/:id  (soft delete) ───────────────────────
router.delete("/:id", protect, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: "Not found" });
    if (msg.senderId.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Forbidden" });
    msg.isDeleted  = true;
    msg.text       = "This message was deleted";
    msg.attachment = undefined;
    await msg.save();
    const full = await populateMsg(Message.findById(msg._id));
    res.json(full);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/messages/:conversationId/attach  (file / image / audio) ──
router.post("/:conversationId/attach", protect, upload.single("attachment"), async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    if (!conv.members.map(String).includes(req.user._id.toString())) return res.status(403).json({ message: "Not a member" });
    if (!req.file) return res.status(400).json({ message: "No file" });

    const url      = `/uploads/${req.file.filename}`;
    const isImage  = req.file.mimetype.startsWith("image/");
    const isAudio  = req.file.mimetype.startsWith("audio/") || req.file.originalname.endsWith(".webm");
    const fileType = isImage ? "image" : isAudio ? "audio" : "file";

    const msg = await Message.create({
      conversationId: conv._id,
      senderId:  req.user._id,
      type:      fileType,
      text:      isImage ? "" : isAudio ? "" : `File: ${req.file.originalname}`,
      attachment: { url, filename: req.file.originalname, mime: req.file.mimetype, size: req.file.size }
    });

    await Conversation.findByIdAndUpdate(conv._id, {
      lastMessage:   isImage ? "📷 Image" : isAudio ? "🎤 Voice" : `📎 ${req.file.originalname}`,
      lastMessageAt: new Date()
    });

    const full = await populateMsg(Message.findById(msg._id));
    res.status(201).json(full);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
