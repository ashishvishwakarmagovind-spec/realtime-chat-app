const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, sparse: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);