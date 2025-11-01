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
console.log("YT_KEY", YT_KEY);

if (!YT_KEY) {
    console.warn("WARNING: No YOUTUBE_API_KEY set in .env — search won't work.");
}

const app = express();
app.use(cors());
app.use(express.json());

// Basic health endpoint
app.get("/", (req, res) => res.json({ ok: true }));

// GET endpoint to check if room exists (for debugging)
app.get("/api/rooms", (req, res) => {
    const roomList = Object.keys(rooms).map(id => ({
        id,
        host: rooms[id].host,
        members: rooms[id].members.size,
        createdAt: rooms[id].createdAt
    }));
    res.json({ rooms: roomList });
});

app.get("/api/rooms/:roomId", (req, res) => {
    const room = rooms[req.params.roomId];
    if (!room) {
        return res.status(404).json({ error: "Room not found" });
    }
    res.json({
        id: req.params.roomId,
        host: room.host,
        members: room.members.size,
        createdAt: room.createdAt
    });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    allowEIO3: true
});

// Simple YouTube Search proxy route
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

// rooms map: roomId -> { host, members: Map(socketId -> {username, joinedAt}), state, createdAt }
const rooms = {};

// Helper function to get room info
function getRoomInfo(roomId) {
    const room = rooms[roomId];
    if (!room) return null;

    const membersList = Array.from(room.members.entries()).map(([sid, info]) => ({
        id: sid,
        username: info.username,
        isHost: room.host === sid
    }));

    return {
        roomId,
        host: room.host,
        memberCount: room.members.size,
        members: membersList
    };
}

io.on("connection", (socket) => {
    console.log("✓ Socket connected:", socket.id);

    // Initialize socket data
    socket.data.username = `User${Math.floor(Math.random() * 9000) + 1000}`;
    socket.data.roomId = null;

    socket.on("create_room", (callback) => {
        try {
            // If already in a room, leave it first
            if (socket.data.roomId) {
                const oldRoom = rooms[socket.data.roomId];
                if (oldRoom) {
                    oldRoom.members.delete(socket.id);
                    socket.leave(socket.data.roomId);
                }
            }

            // Generate unique room ID
            let id;
            let attempts = 0;
            do {
                id = Math.random().toString(36).slice(2, 8);
                attempts++;
            } while (rooms[id] && attempts < 10);

            if (rooms[id]) {
                throw new Error("Failed to generate unique room ID");
            }

            // Create room with Map for members (stores more info)
            rooms[id] = {
                host: socket.id,
                members: new Map([[socket.id, {
                    username: socket.data.username,
                    joinedAt: Date.now()
                }]]),
                state: null, // Will store video state
                createdAt: Date.now()
            };

            socket.join(id);
            socket.data.roomId = id;

            console.log(`✓ Room created: ${id} by ${socket.id} (${socket.data.username})`);
            console.log(`  Active rooms: ${Object.keys(rooms).length}`);

            const response = {
                ok: true,
                roomId: id,
                username: socket.data.username,
                isHost: true
            };

            if (typeof callback === 'function') {
                callback(response);
            } else {
                socket.emit("room_created", response);
            }
        } catch (err) {
            console.error("✗ Error creating room:", err);
            const error = { ok: false, error: err.message || "Failed to create room" };
            if (typeof callback === 'function') {
                callback(error);
            } else {
                socket.emit("error", error);
            }
        }
    });

    socket.on("join_room", ({ roomId, username }, callback) => {
        try {
            console.log(`→ Join request: socket=${socket.id}, room=${roomId}, username=${username}`);

            if (!roomId) {
                const error = { ok: false, error: "Room ID is required" };
                console.log("✗ No room ID provided");
                if (typeof callback === 'function') callback(error);
                else socket.emit("join_error", error);
                return;
            }

            const room = rooms[roomId];
            if (!room) {
                const availableRooms = Object.keys(rooms);
                console.log(`✗ Room ${roomId} not found`);
                console.log(`  Available rooms: [${availableRooms.join(', ') || 'none'}]`);
                const error = {
                    ok: false,
                    error: "Room not found",
                    availableRooms: availableRooms.length
                };
                if (typeof callback === 'function') callback(error);
                else socket.emit("join_error", error);
                return;
            }

            // Update username if provided
            if (username && username.trim()) {
                socket.data.username = username.trim();
            }

            // Leave any previous room
            if (socket.data.roomId && socket.data.roomId !== roomId) {
                const oldRoom = rooms[socket.data.roomId];
                if (oldRoom) {
                    oldRoom.members.delete(socket.id);
                    socket.leave(socket.data.roomId);
                    console.log(`  Left old room: ${socket.data.roomId}`);
                }
            }

            // Join new room
            room.members.set(socket.id, {
                username: socket.data.username,
                joinedAt: Date.now()
            });
            socket.join(roomId);
            socket.data.roomId = roomId;

            console.log(`✓ ${socket.id} joined room ${roomId} as "${socket.data.username}"`);
            console.log(`  Room ${roomId} now has ${room.members.size} member(s)`);

            // Get updated member list
            const membersList = Array.from(room.members.entries()).map(([sid, info]) => ({
                id: sid,
                username: info.username,
                isHost: room.host === sid
            }));

            // Send success response first
            const response = {
                ok: true,
                roomId,
                username: socket.data.username,
                isHost: room.host === socket.id,
                memberCount: room.members.size,
                members: membersList
            };

            if (typeof callback === 'function') {
                callback(response);
            } else {
                socket.emit("join_success", response);
            }

            // **FIX: Automatically send current video state to the new user**
            if (room.state && room.state.videoId) {
                console.log(`  Sending current video state to new user: ${room.state.videoId}`);
                socket.emit("sync_state", room.state);
            }

            // Then notify everyone in room about member update
            io.to(roomId).emit("member_update", {
                members: room.members.size,
                membersList: membersList
            });

            // Broadcast join notification to others
            socket.to(roomId).emit("user_joined", {
                username: socket.data.username,
                socketId: socket.id,
                memberCount: room.members.size
            });

        } catch (err) {
            console.error("✗ Error joining room:", err);
            const error = { ok: false, error: err.message || "Failed to join room" };
            if (typeof callback === 'function') {
                callback(error);
            } else {
                socket.emit("join_error", error);
            }
        }
    });

    // Playback events
    socket.on("change_video", ({ videoId, startTime = 0 }) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) {
            console.log("✗ change_video: not in a valid room");
            return;
        }

        // Update room state
        rooms[roomId].state = { videoId, startTime, playing: false, timestamp: Date.now() };

        console.log(`Video changed in room ${roomId}: ${videoId} at ${startTime}s`);
        io.to(roomId).emit("change_video", {
            videoId,
            startTime,
            by: socket.data.username
        });
    });

    socket.on("play", ({ time }) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) return;

        if (rooms[roomId].state) {
            rooms[roomId].state.playing = true;
            rooms[roomId].state.time = time;
            rooms[roomId].state.timestamp = Date.now();
        }

        socket.to(roomId).emit("play", {
            time,
            by: socket.data.username
        });
    });

    socket.on("pause", ({ time }) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) return;

        if (rooms[roomId].state) {
            rooms[roomId].state.playing = false;
            rooms[roomId].state.time = time;
            rooms[roomId].state.timestamp = Date.now();
        }

        socket.to(roomId).emit("pause", {
            time,
            by: socket.data.username
        });
    });

    socket.on("seek", ({ time }) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) return;

        if (rooms[roomId].state) {
            rooms[roomId].state.time = time;
            rooms[roomId].state.timestamp = Date.now();
        }

        socket.to(roomId).emit("seek", {
            time,
            by: socket.data.username
        });
    });

    // Sync mechanism - now returns saved state if available
    socket.on("request_sync", () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;

        const room = rooms[roomId];
        if (!room) return;

        console.log(`Sync requested by ${socket.id} in room ${roomId}`);

        // If we have saved state, send it directly
        if (room.state) {
            console.log(`  Sending saved state:`, room.state);
            socket.emit("sync_state", room.state);
        } else {
            // Otherwise ask host
            io.to(room.host).emit("request_sync_from_host", {
                toSocket: socket.id
            });
        }
    });

    socket.on("sync_state", ({ toSocket, state }) => {
        if (!toSocket || !state) return;

        // Save state to room
        const roomId = socket.data.roomId;
        if (roomId && rooms[roomId]) {
            rooms[roomId].state = state;
        }

        console.log(`Sending sync state to ${toSocket}`);
        io.to(toSocket).emit("sync_state", state);
    });

    // Chat
    socket.on("chat_message", ({ text }) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) return;

        if (!text || !text.trim()) return;

        const msg = {
            type: "chat_message",
            user: socket.data.username,
            socketId: socket.id,
            text: text.trim(),
            timestamp: Date.now()
        };

        io.to(roomId).emit("chat_message", msg);
    });

    socket.on("set_username", ({ username }, callback) => {
        const oldUsername = socket.data.username;
        socket.data.username = username || socket.data.username;

        // Update in room if present
        const roomId = socket.data.roomId;
        if (roomId && rooms[roomId] && rooms[roomId].members.has(socket.id)) {
            rooms[roomId].members.get(socket.id).username = socket.data.username;
        }

        console.log(`Username changed: ${oldUsername} → ${socket.data.username}`);

        if (typeof callback === 'function') {
            callback({ ok: true, username: socket.data.username });
        }

        // Notify room members
        if (roomId && rooms[roomId]) {
            socket.to(roomId).emit("username_changed", {
                socketId: socket.id,
                oldUsername,
                newUsername: socket.data.username
            });
        }
    });

    socket.on("disconnect", (reason) => {
        console.log(`✗ Socket disconnected: ${socket.id} (${reason})`);

        const roomId = socket.data.roomId;
        if (!roomId) return;

        const room = rooms[roomId];
        if (!room) return;

        room.members.delete(socket.id);
        console.log(`  Removed from room ${roomId}, ${room.members.size} member(s) remain`);

        // Handle host leaving
        if (room.host === socket.id) {
            if (room.members.size > 0) {
                // Transfer host to another member
                const newHost = Array.from(room.members.keys())[0];
                room.host = newHost;
                console.log(`  New host for room ${roomId}: ${newHost}`);
                io.to(newHost).emit("you_are_host");
                io.to(roomId).emit("host_changed", { newHost });
            } else {
                // Delete empty room
                delete rooms[roomId];
                console.log(`  Room ${roomId} deleted (empty)`);
                console.log(`  Active rooms: ${Object.keys(rooms).length}`);
                return;
            }
        }

        // Update members
        const membersList = Array.from(room.members.entries()).map(([sid, info]) => ({
            id: sid,
            username: info.username,
            isHost: room.host === sid
        }));

        io.to(roomId).emit("member_update", {
            members: room.members.size,
            membersList: membersList
        });

        // Notify about user leaving
        io.to(roomId).emit("user_left", {
            username: socket.data.username,
            socketId: socket.id,
            memberCount: room.members.size
        });
    });

    // Error handling
    socket.on("error", (err) => {
        console.error(`Socket error for ${socket.id}:`, err);
    });

    // Connection error handling
    socket.on("connect_error", (err) => {
        console.error(`Connection error for ${socket.id}:`, err);
    });
});

// Periodic cleanup of stale rooms (optional but recommended)
setInterval(() => {
    const now = Date.now();
    const ROOM_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

    let cleaned = 0;
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.createdAt && now - room.createdAt > ROOM_TIMEOUT) {
            console.log(`Cleaning up stale room: ${roomId}`);
            delete rooms[roomId];
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} stale room(s). Active rooms: ${Object.keys(rooms).length}`);
    }
}, 60 * 60 * 1000); // Run every hour

// Log active rooms every 5 minutes
setInterval(() => {
    const roomCount = Object.keys(rooms).length;
    if (roomCount > 0) {
        console.log(`\n=== Active Rooms: ${roomCount} ===`);
        Object.entries(rooms).forEach(([id, room]) => {
            console.log(`  ${id}: ${room.members.size} members, host: ${room.host}`);
        });
        console.log('========================\n');
    }
}, 5 * 60 * 1000);

httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server listening on http://localhost:${PORT}`);
    console.log(`✓ Socket.IO ready`);
    console.log(`✓ CORS enabled for all origins`);
});