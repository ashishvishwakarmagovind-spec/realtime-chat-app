const mongoose = require("mongoose");

const InviteCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  invitedPhone: { type: String },
  invitedEmail: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  usedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("InviteCode", InviteCodeSchema);
