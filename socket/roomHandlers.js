const { getRoomInfo } = require("../utils/helpers");

const rooms = {};

function handleRoomEvents(io, socket) {
    socket.data.username = `User${Math.floor(Math.random() * 9000) + 1000}`;

    socket.on("create_room", (callback) => {
        try {
            const id = Math.random().toString(36).substring(2, 8);
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

            if (typeof callback === "function") callback(response);
            else socket.emit("room_created", response);
        } catch (err) {
            console.error("Error creating room:", err);
            if (typeof callback === "function")
                callback({ ok: false, error: "Failed to create room" });
        }
    });

    socket.on("join_room", ({ roomId, username }, callback) => {
        const room = rooms[roomId];
        if (!room) {
            const error = { ok: false, error: "Room not found" };
            return typeof callback === "function"
                ? callback(error)
                : socket.emit("join_error", error);
        }

        if (username) socket.data.username = username;
        room.members.set(socket.id, { username: socket.data.username });
        socket.join(roomId);
        socket.data.roomId = roomId;

        const info = getRoomInfo(roomId, rooms);
        io.to(roomId).emit("member_update", info);
        if (typeof callback === "function") callback({ ok: true, ...info });
    });

    socket.on("chat_message", ({ text }) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId] || !text) return;

        const msg = {
            user: socket.data.username,
            text,
            timestamp: Date.now(),
        };
        io.to(roomId).emit("chat_message", msg);
    });
}

module.exports = { handleRoomEvents, rooms };
