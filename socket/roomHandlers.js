// server/socket/socketHandlers.js
export const rooms = {};

// Your helper (you can move this to utils/helpers.js later if you want)
const getRoomInfo = (roomId, roomsObj) => {
    const room = roomsObj[roomId];
    if (!room) return null;
    return {
        roomId,
        memberCount: room.members.size,
        membersList: Array.from(room.members.entries()).map(([id, info]) => ({
            id,
            username: info.username,
            isHost: room.host === id
        }))
    };
};

export function handleRoomEvents(io, socket) {
    socket.data = {
        username: `User${Math.floor(Math.random() * 9000) + 1000}`,
        roomId: null
    };

    socket.on("create_room", (callback) => {
        try {
            // Leave previous room if any
            if (socket.data.roomId) {
                socket.leave(socket.data.roomId);
                rooms[socket.data.roomId]?.members.delete(socket.id);
            }

            let id;
            do {
                id = Math.random().toString(36).substring(2, 8);
            } while (rooms[id]);

            rooms[id] = {
                host: socket.id,
                members: new Map([[socket.id, { username: socket.data.username }]]),
                state: null,
                createdAt: Date.now(),
            };

            socket.join(id);
            socket.data.roomId = id;

            const response = {
                ok: true,
                roomId: id,
                username: socket.data.username,
                isHost: true,
            };

            typeof callback === "function" ? callback(response) : socket.emit("room_created", response);
        } catch (err) {
            console.error("Error creating room:", err);
            typeof callback === "function" && callback({ ok: false, error: "Failed to create room" });
        }
    });

    socket.on("join_room", ({ roomId, username }, callback) => {
        try {
            if (!roomId || !rooms[roomId]) {
                const err = { ok: false, error: "Room not found" };
                return typeof callback === "function" ? callback(err) : socket.emit("join_error", err);
            }

            // Leave old room
            if (socket.data.roomId && socket.data.roomId !== roomId) {
                socket.leave(socket.data.roomId);
                rooms[socket.data.roomId]?.members.delete(socket.id);
            }

            if (username?.trim()) socket.data.username = username.trim();

            const room = rooms[roomId];
            room.members.set(socket.id, { username: socket.data.username });
            socket.join(roomId);
            socket.data.roomId = roomId;

            const info = {
                ok: true,
                roomId,
                username: socket.data.username,
                isHost: room.host === socket.id,
                memberCount: room.members.size,
                membersList: Array.from(room.members.entries()).map(([id, info]) => ({
                    id,
                    username: info.username,
                    isHost: room.host === id
                }))
            };

            // Notify everyone
            io.to(roomId).emit("member_update", info);
            socket.to(roomId).emit("user_joined", { username: socket.data.username });

            typeof callback === "function" && callback(info);

            // Auto-sync video state if exists
            if (room.state?.videoId) {
                socket.emit("sync_state", room.state);
            }
        } catch (err) {
            console.error("Join error:", err);
            typeof callback === "function" && callback({ ok: false, error: err.message });
        }
    });

    socket.on("chat_message", ({ text }) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId] || !text?.trim()) return;

        io.to(roomId).emit("chat_message", {
            user: socket.data.username,
            text: text.trim(),
            timestamp: Date.now()
        });
    });

    // Add your playback events here (change_video, play, pause, seek, etc.)
    // ... just like in your original code

    socket.on("disconnect", () => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        room.members.delete(socket.id);

        if (room.host === socket.id && room.members.size > 0) {
            const [newHost] = room.members.keys();
            room.host = newHost;
            io.to(newHost).emit("you_are_host");
        }

        if (room.members.size === 0) {
            delete rooms[roomId];
        } else {
            io.to(roomId).emit("member_update", {
                memberCount: room.members.size,
                membersList: Array.from(room.members.entries()).map(([id, info]) => ({
                    id,
                    username: info.username,
                    isHost: room.host === id
                }))
            });
            io.to(roomId).emit("user_left", { username: socket.data.username });
        }
    });
}

// Optional: cleanup intervals
setInterval(() => {
    const now = Date.now();
    for (const [id, room] of Object.entries(rooms)) {
        if (now - room.createdAt > 24 * 60 * 60 * 1000) {
            delete rooms[id];
        }
    }
}, 60 * 60 * 1000);