import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";
import youtubeRoutes from "./routes/youtubeRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { handleRoomEvents } from "./socket/roomHandlers.js";
import { testConnection } from "./db/config.js";
import { initDatabase } from "./db/init.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.get("/", (_, res) => res.json({ ok: true }));

// Routes
app.use("/api/search", youtubeRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/users", userRoutes);

// HTTP + Socket.IO server
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true
});

// Attach socket logic
io.on("connection", (socket) => handleRoomEvents(io, socket));

// Start server with database initialization
async function startServer() {
    try {
        // Test database connection
        await testConnection();

        // Initialize database schema
        await initDatabase();

        server.listen(PORT, () => {
            console.log(`\nServer running on http://localhost:${PORT}`);
            console.log(`Socket.IO ready • CORS enabled • Database connected`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();