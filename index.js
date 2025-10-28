require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const roomRoutes = require("./routes/roomRoutes");
const youtubeRoutes = require("./routes/youtubeRoutes");
const initializeSocket = require("./config/socket");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Basic route
app.get("/", (req, res) => res.json({ ok: true }));

// API Routes
app.use("/api/rooms", roomRoutes);
app.use("/api/search", youtubeRoutes);

// Create HTTP + Socket.IO server
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

// Initialize Socket.IO logic
initializeSocket(io);

// Start server
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
