const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  senderId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:           { type: String, enum: ["text", "image", "file", "audio"], default: "text" },
  text:           { type: String, default: "" },
  attachment:     {
    url:      String,
    filename: String,
    mime:     String,
    size:     Number
  },
  isEdited:  { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  replyTo:   { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }
}, { timestamps: true });

module.exports = mongoose.model("Message", MessageSchema);