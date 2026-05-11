const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const Conversation = require("../models/Conversation");
const InviteCode = require("../models/InviteCode");
const { protect } = require("../middleware/authMiddleware");

const getTwilioClient = () => {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return null;
};

const createTransporter = async () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    let testAccount = await nodemailer.createTestAccount();
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

const generateCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const getExpiry = () => new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

// POST /api/invites/sms
router.post("/sms", protect, async (req, res) => {
  const { phone, isGroup, groupName } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone is required" });

  try {
    const code = generateCode();
    
    // Create placeholder conversation
    const conversation = await Conversation.create({
      isGroup: isGroup || false,
      name: groupName || "New Chat",
      members: [req.user._id],
      createdBy: req.user._id,
    });

    // Save InviteCode
    await InviteCode.create({
      code,
      conversationId: conversation._id,
      invitedPhone: phone,
      createdBy: req.user._id,
      expiresAt: getExpiry()
    });

    const twilioClient = getTwilioClient();
    if (twilioClient) {
      await twilioClient.messages.create({
        body: `Hello! ${req.user.name} invited you to a Realtime Chat. Login and join with code: ${code}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: phone
      });
      res.status(200).json({ message: "SMS invite sent successfully", conversationId: conversation._id });
    } else {
      console.log(`\n[DEV MODE] SMS Invite to ${phone} -> CODE: ${code}\n`);
      res.status(200).json({ message: "SMS logged to console (Dev Mode)", conversationId: conversation._id });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send SMS invite" });
  }
});

// POST /api/invites/email
router.post("/email", protect, async (req, res) => {
  const { email, isGroup, groupName } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const code = generateCode();
    
    const conversation = await Conversation.create({
      isGroup: isGroup || false,
      name: groupName || "New Chat",
      members: [req.user._id],
      createdBy: req.user._id,
    });

    await InviteCode.create({
      code,
      conversationId: conversation._id,
      invitedEmail: email,
      createdBy: req.user._id,
      expiresAt: getExpiry()
    });

    const transporter = await createTransporter();
    const mailOptions = {
      from: process.env.MAIL_FROM || '"Realtime Chat" <noreply@example.com>',
      to: email,
      subject: "You've been invited to a Realtime Chat!",
      html: `
        <h2>Hello!</h2>
        <p><strong>${req.user.name}</strong> has invited you to join a chat.</p>
        <p>Join code:</p>
        <h1 style="color: #5E5CE6; letter-spacing: 2px;">${code}</h1>
      `,
    };

    let info = await transporter.sendMail(mailOptions);
    let previewUrl = process.env.SMTP_HOST ? null : nodemailer.getTestMessageUrl(info);
    
    if (previewUrl) {
        console.log(`\n[DEV MODE] Email Invite to ${email} -> CODE: ${code}\nURL: ${previewUrl}\n`);
    }

    res.status(200).json({ 
      message: "Email invite sent successfully", 
      conversationId: conversation._id,
      previewUrl 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send Email invite" });
  }
});

// POST /api/invites/join
router.post("/join", protect, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: "Code is required" });

  try {
    const invite = await InviteCode.findOne({ code: code.toUpperCase() });
    if (!invite) return res.status(404).json({ message: "Invalid code" });
    if (invite.usedBy) return res.status(400).json({ message: "Code already used" });
    if (new Date() > invite.expiresAt) return res.status(400).json({ message: "Code has expired" });

    // Mark used
    invite.usedBy = req.user._id;
    invite.usedAt = new Date();
    await invite.save();

    const conversation = await Conversation.findById(invite.conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    // Add user to members
    if (!conversation.members.includes(req.user._id)) {
      conversation.members.push(req.user._id);
      await conversation.save();
    }

    const fullConversation = await Conversation.findById(conversation._id).populate("members", "-passwordHash");
    res.status(200).json(fullConversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to join conversation" });
  }
});

module.exports = router;
