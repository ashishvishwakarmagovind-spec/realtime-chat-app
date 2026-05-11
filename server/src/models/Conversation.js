const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  isGroup: { type: Boolean, default: false },
  name: { type: String },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  lastMessage: { type: String },
  lastMessageAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Conversation", ConversationSchema);