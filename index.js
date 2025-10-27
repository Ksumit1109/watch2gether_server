// server/index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";

dotenv.config();

const PORT = process.env.PORT || 5000;
const YT_KEY = process.env.YOUTUBE_API_KEY;
console.log("YT_KEY", YT_KEY)

if (!YT_KEY) {
    console.warn("WARNING: No YOUTUBE_API_KEY set in .env — search won't work.");
}

const app = express();
app.use(cors());
app.use(express.json());

// Simple YouTube Search proxy route (server keeps your API key secret)
app.get("/api/search", async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "missing query param q" });
    const maxResults = Math.min(parseInt(req.query.maxResults || "8"), 50);

    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(
        q
    )}&key=${YT_KEY}`;

    try {
        const r = await fetch(apiUrl);
        const data = await r.json();
        return res.json(data);
    } catch (err) {
        console.error("YouTube API error:", err);
        return res.status(500).json({ error: "youtube api error", details: String(err) });
    }
});

// Basic health endpoint
app.get("/", (req, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: { origin: "*" }
});

// rooms map: roomId -> { hostSocketId, members: Set(socketId) }
const rooms = {};

io.on("connection", (socket) => {
    console.log("socket connected", socket.id);

    socket.on("create_room", (cb) => {
        // create simple short id
        const id = Math.random().toString(36).slice(2, 8);
        rooms[id] = { host: socket.id, members: new Set([socket.id]) };
        socket.join(id);
        socket.data.roomId = id;
        socket.data.username = `User${Math.floor(Math.random() * 9000) + 100}`;
        console.log(`room ${id} created by ${socket.id}`);
        if (cb) cb({ roomId: id });
    });

    socket.on("join_room", ({ roomId, username }, cb) => {
        const room = rooms[roomId];
        if (!room) {
            if (cb) cb({ ok: false, error: "room not found" });
            return;
        }
        room.members.add(socket.id);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.username = username || socket.data.username || `User${Math.floor(Math.random() * 9000) + 100}`;
        // notify everyone a user joined
        io.to(roomId).emit("member_update", { members: Array.from(room.members).length });
        if (cb) cb({ ok: true });
    });

    // playback events broadcast to others in same room
    socket.on("change_video", ({ videoId, startTime = 0 }) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        io.to(roomId).emit("change_video", { videoId, startTime, by: socket.data.username });
    });
    socket.on("play", ({ time }) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        socket.to(roomId).emit("play", { time, by: socket.data.username });
    });
    socket.on("pause", ({ time }) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        socket.to(roomId).emit("pause", { time, by: socket.data.username });
    });
    socket.on("seek", ({ time }) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        socket.to(roomId).emit("seek", { time, by: socket.data.username });
    });

    // Sync request: new joiner asks host for current state
    socket.on("request_sync", () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room) return;
        // ask host to send sync_state directly to this socket
        io.to(room.host).emit("request_sync_from_host", { toSocket: socket.id });
    });

    // Host responds with sync_state
    socket.on("sync_state", ({ toSocket, state }) => {
        io.to(toSocket).emit("sync_state", state);
    });

    // Chat
    socket.on("chat_message", ({ text }) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const msg = {
            type: "chat_message",
            user: socket.data.username,
            text,
            timestamp: Date.now()
        };
        io.to(roomId).emit("chat_message", msg);
    });

    socket.on("set_username", ({ username }, cb) => {
        socket.data.username = username || socket.data.username;
        if (cb) cb({ ok: true });
    });

    socket.on("disconnect", () => {
        console.log("disconnect", socket.id);
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room) return;
        room.members.delete(socket.id);
        // if host left, pick a new host or delete room
        if (room.host === socket.id) {
            if (room.members.size > 0) {
                const newHost = Array.from(room.members)[0];
                room.host = newHost;
                io.to(newHost).emit("you_are_host");
            } else {
                delete rooms[roomId];
                console.log("room deleted", roomId);
            }
        }
        io.to(roomId).emit("member_update", { members: room.members ? Array.from(room.members).length : 0 });
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
