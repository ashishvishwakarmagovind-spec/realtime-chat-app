const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

// Nodemailer transporter (Ethereal for testing, or real SMTP if provided)
const createTransporter = async () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Generate test SMTP service account from ethereal.email
    let testAccount = await nodemailer.createTestAccount();
    console.log("No SMTP settings provided. Using Ethereal test account:", testAccount.user);
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
};

// POST /api/conversations
// Create or fetch 1-on-1, or create group
router.post("/", protect, async (req, res) => {
  const { userId, isGroup, name, members } = req.body;

  if (isGroup) {
    if (!members || members.length < 1) return res.status(400).send("Fill all members");
    members.push(req.user._id);
    try {
      const groupChat = await Conversation.create({ name, isGroup: true, members, createdBy: req.user._id });
      const fullGroupChat = await Conversation.findOne({ _id: groupChat._id }).populate("members", "-passwordHash");
      return res.status(200).json(fullGroupChat);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  // 1-on-1 chat
  if (!userId) return res.status(400).send("UserId not sent");

  let isChat = await Conversation.find({
    isGroup: false,
    $and: [
      { members: { $elemMatch: { $eq: req.user._id } } },
      { members: { $elemMatch: { $eq: userId } } },
    ],
  }).populate("members", "-passwordHash");

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    var chatData = {
      name: "sender",
      isGroup: false,
      members: [req.user._id, userId],
      createdBy: req.user._id
    };

    try {
      const createdChat = await Conversation.create(chatData);
      const FullChat = await Conversation.findOne({ _id: createdChat._id }).populate("members", "-passwordHash");
      res.status(200).json(FullChat);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
});

// POST /api/conversations/direct-by-phone
router.post("/direct-by-phone", protect, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone is required" });

  try {
    const targetUser = await User.findOne({ phone });
    if (!targetUser) return res.status(404).json({ message: "User with this phone not found" });

    // check if chat exists
    let chat = await Conversation.findOne({
      isGroup: false,
      members: { $all: [req.user._id, targetUser._id] }
    });

    if (!chat) {
      chat = await Conversation.create({
        isGroup: false,
        members: [req.user._id, targetUser._id],
        createdBy: req.user._id,
        lastMessage: "Hi",
        lastMessageAt: Date.now()
      });
    }
    
    const fullChat = await Conversation.findById(chat._id).populate("members", "-passwordHash");
    res.status(200).json({ chat: fullChat, isNew: !chat });
  } catch (err) {
    res.status(500).json({ message: "Failed to create direct chat" });
  }
});

// GET /api/conversations
router.get("/", protect, async (req, res) => {
  try {
    let results = await Conversation.find({ members: { $elemMatch: { $eq: req.user._id } } })
      .populate("members", "-passwordHash")
      .sort({ updatedAt: -1 });

    res.status(200).send(results);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/conversations/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Not found" });
    if (!conversation.members.includes(req.user._id)) return res.status(403).json({ message: "Not authorized" });
    
    await Conversation.findByIdAndDelete(req.params.id);
    await Message.deleteMany({ conversationId: req.params.id });
    res.status(200).json({ message: "Conversation deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/conversations/invite-email
router.post("/invite-email", protect, async (req, res) => {
  const { email, isGroup, groupName, existingConversationId } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    // Generate a secure 6-character code
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let conversation;

    if (existingConversationId) {
      conversation = await Conversation.findById(existingConversationId);
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });
      if (!conversation.members.includes(req.user._id)) return res.status(403).json({ message: "Not authorized" });
    } else {
      // Create new placeholder conversation
      conversation = await Conversation.create({
        isGroup: isGroup || false,
        name: groupName || "New Chat",
        members: [req.user._id],
        createdBy: req.user._id,
      });
    }

    conversation.inviteCodes.push({ code, emailInvited: email, expiresAt });
    await conversation.save();

    // Send Email
    const transporter = await createTransporter();
    const mailOptions = {
      from: process.env.MAIL_FROM || '"Realtime Chat" <noreply@example.com>',
      to: email,
      subject: "You've been invited to a Realtime Chat!",
      html: `
        <h2>Hello!</h2>
        <p><strong>${req.user.name}</strong> has invited you to join a chat conversation.</p>
        <p>Use the following invite code after logging into the app:</p>
        <h1 style="color: #5E5CE6; letter-spacing: 2px;">${code}</h1>
        <p>This code will expire in 24 hours.</p>
      `,
    };

    let info = await transporter.sendMail(mailOptions);
    let previewUrl = nodemailer.getTestMessageUrl(info);
    
    res.status(200).json({ 
      message: "Invite sent successfully", 
      conversationId: conversation._id,
      previewUrl: previewUrl || null 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send invite" });
  }
});

// POST /api/conversations/join-code
router.post("/join-code", protect, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: "Code is required" });

  try {
    // Find conversation with this code
    const conversation = await Conversation.findOne({ 
      "inviteCodes.code": code.toUpperCase() 
    });

    if (!conversation) return res.status(404).json({ message: "Invalid code" });

    // Find the specific code entry
    const inviteEntry = conversation.inviteCodes.find(c => c.code === code.toUpperCase());

    if (inviteEntry.usedBy) {
      return res.status(400).json({ message: "Code already used" });
    }

    if (new Date() > inviteEntry.expiresAt) {
      return res.status(400).json({ message: "Code has expired" });
    }

    // Mark used
    inviteEntry.usedBy = req.user._id;
    inviteEntry.usedAt = new Date();

    // Add user to members if not already
    if (!conversation.members.includes(req.user._id)) {
      conversation.members.push(req.user._id);
    }

    // If it was a 1-on-1 placeholder, we can rename it or just let the client handle naming
    await conversation.save();

    const fullConversation = await Conversation.findById(conversation._id).populate("members", "-passwordHash");

    res.status(200).json(fullConversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to join conversation" });
  }
});

module.exports = router;
