const jwt    = require("jsonwebtoken");
const User   = require("../models/User");
const Message        = require("../models/Message");
const Conversation   = require("../models/Conversation");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

// Populate helper
const populateMsg = (q) =>
  q.populate("senderId", "name phone email")
   .populate({ path: "replyTo", populate: { path: "senderId", select: "name" } });

const initSocket = (io) => {

  // ── Auth middleware ──────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user    = await User.findById(decoded.id).select("-passwordHash");
      if (!user) return next(new Error("User not found"));
      socket.user = user;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  const onlineUsers = new Map(); // userId → Set<socketId>

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();

    // Join personal room so we can deliver messages even without conv join
    socket.join(userId);

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    io.emit("presence:update", Array.from(onlineUsers.keys()));

    console.log(`[socket] ${socket.user.name} connected (${socket.id})`);

    // ── Join conversation room ──────────────────────────────────
    socket.on("conversation:join", ({ conversationId }) => {
      socket.join(conversationId);
    });

    // ── Send message ──────────────────────────────────────────────
    socket.on("message:send", async ({ conversationId, text, replyTo }) => {
      try {
        const msg = await Message.create({
          conversationId,
          senderId: socket.user._id,
          type: "text",
          text: text || "",
          replyTo: replyTo || null
        });

        // Update conversation's last-message preview
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage:   text,
          lastMessageAt: new Date()
        });

        const full = await populateMsg(Message.findById(msg._id));

        // Broadcast to every member's personal room
        const conv = await Conversation.findById(conversationId).select("members");
        conv.members.forEach(mid => io.to(mid.toString()).emit("message:new", full));
      } catch (err) {
        console.error("[socket] message:send error:", err.message);
        socket.emit("message:error", { message: "Failed to send message" });
      }
    });

    // ── Edit message ──────────────────────────────────────────────
    socket.on("message:update", async ({ conversationId, message }) => {
      const conv = await Conversation.findById(conversationId).select("members");
      if (!conv) return;
      conv.members.forEach(mid => io.to(mid.toString()).emit("message:updated", message));
    });

    // ── Delete message ────────────────────────────────────────────
    socket.on("message:delete", async ({ conversationId, message }) => {
      const conv = await Conversation.findById(conversationId).select("members");
      if (!conv) return;
      conv.members.forEach(mid => io.to(mid.toString()).emit("message:deleted", message));
    });

    // ── Typing ──────────────────────────────────────────────────
    socket.on("typing:start", ({ conversationId }) => {
      socket.to(conversationId).emit("typing:start", { conversationId, user: socket.user });
    });

    socket.on("typing:stop", ({ conversationId }) => {
      socket.to(conversationId).emit("typing:stop", { conversationId });
    });

    // ── Call signalling ──────────────────────────────────────────
    socket.on("call:request", ({ conversationId, type }) => {
      socket.to(conversationId).emit("call:incoming", {
        conversationId, type,
        callerId: socket.user._id, callerName: socket.user.name
      });
    });
    socket.on("call:accept", ({ conversationId }) => socket.to(conversationId).emit("call:accepted", { conversationId }));
    socket.on("call:reject", ({ conversationId }) => socket.to(conversationId).emit("call:rejected", { conversationId }));

    // ── Disconnect ───────────────────────────────────────────────
    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit("presence:update", Array.from(onlineUsers.keys()));
        }
      }
      console.log(`[socket] ${socket.user.name} disconnected`);
    });
  });
};

module.exports = initSocket;
