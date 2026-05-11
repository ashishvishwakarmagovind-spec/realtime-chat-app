require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const conversationRoutes = require("./routes/conversation.routes");
const messageRoutes = require("./routes/message.routes");
const initSocket = require("./socket/index");

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use("/uploads", express.static("uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/invites", require("./routes/invite.routes"));

app.get("/", (req, res) => res.send("API running"));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

initSocket(io);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });