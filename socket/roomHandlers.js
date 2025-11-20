import * as db from '../db/queries.js';

// Keep in-memory map for socket connections
export const rooms = {};

const getRoomInfo = async (roomId) => {
    const room = rooms[roomId];
    if (!room) return null;

    const members = await db.getRoomMembers(roomId);

    return {
        roomId,
        memberCount: members.length,
        membersList: members.map(m => ({
            id: m.socket_id,
            username: m.username,
            isHost: room.host === m.socket_id
        }))
    };
};

export function handleRoomEvents(io, socket) {
    socket.data = {
        username: `User${Math.floor(Math.random() * 9000) + 1000}`,
        roomId: null
    };

    socket.on("create_room", async (callback) => {
        try {
            // Leave previous room
            if (socket.data.roomId) {
                socket.leave(socket.data.roomId);
                await db.removeMember(socket.id);
                rooms[socket.data.roomId]?.members.delete(socket.id);
            }

            let id;
            do {
                id = Math.random().toString(36).substring(2, 8);
            } while (rooms[id] || await db.getRoom(id));

            // Create in database
            await db.createRoom(id, socket.id);
            await db.addRoomMember(id, socket.id, socket.data.username);

            // Keep in-memory reference
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

    socket.on("join_room", async ({ roomId, username }, callback) => {
        try {
            const dbRoom = await db.getRoom(roomId);
            if (!dbRoom) {
                const err = { ok: false, error: "Room not found" };
                return typeof callback === "function" ? callback(err) : socket.emit("join_error", err);
            }

            // Leave old room
            if (socket.data.roomId && socket.data.roomId !== roomId) {
                socket.leave(socket.data.roomId);
                await db.removeMember(socket.id);
                rooms[socket.data.roomId]?.members.delete(socket.id);
            }

            if (username?.trim()) socket.data.username = username.trim();

            // Add to database
            await db.addRoomMember(roomId, socket.id, socket.data.username);

            // Update in-memory
            if (!rooms[roomId]) {
                rooms[roomId] = {
                    host: dbRoom.host_socket_id,
                    members: new Map(),
                    state: dbRoom.video_state,
                    createdAt: new Date(dbRoom.created_at).getTime(),
                };
            }
            rooms[roomId].members.set(socket.id, { username: socket.data.username });

            socket.join(roomId);
            socket.data.roomId = roomId;

            const info = await getRoomInfo(roomId);
            info.ok = true;
            info.username = socket.data.username;
            info.isHost = rooms[roomId].host === socket.id;

            // Get chat history
            const chatHistory = await db.getChatHistory(roomId);
            info.chatHistory = chatHistory.reverse();

            // Notify everyone
            io.to(roomId).emit("member_update", info);
            socket.to(roomId).emit("user_joined", { username: socket.data.username });
            typeof callback === "function" && callback(info);

            // Sync video state
            if (rooms[roomId].state?.videoId) {
                socket.emit("sync_state", rooms[roomId].state);
            }
        } catch (err) {
            console.error("Join error:", err);
            typeof callback === "function" && callback({ ok: false, error: err.message });
        }
    });

    socket.on("chat_message", async ({ text }) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId] || !text?.trim()) return;

        // Save to database
        await db.saveChatMessage(roomId, socket.data.username, text.trim());

        io.to(roomId).emit("chat_message", {
            user: socket.data.username,
            text: text.trim(),
            timestamp: Date.now()
        });
    });

    socket.on("disconnect", async () => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        room.members.delete(socket.id);
        await db.removeMember(socket.id);

        if (room.host === socket.id && room.members.size > 0) {
            const [newHost] = room.members.keys();
            room.host = newHost;
            await db.updateRoomHost(roomId, newHost);
            io.to(newHost).emit("you_are_host");
        }

        if (room.members.size === 0) {
            delete rooms[roomId];
            await db.deleteRoom(roomId);
        } else {
            const info = await getRoomInfo(roomId);
            io.to(roomId).emit("member_update", info);
            io.to(roomId).emit("user_left", { username: socket.data.username });
        }
    });
}

// Cleanup old rooms from database
setInterval(async () => {
    await db.cleanupOldRooms(24);
}, 60 * 60 * 1000);