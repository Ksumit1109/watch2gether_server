import { rooms } from "../socket/roomHandlers.js";

const getRoomInfo = (id) => ({
    id,
    host: rooms[id]?.host,
    members: rooms[id]?.members.size ?? 0,
    createdAt: rooms[id]?.createdAt
});

export const getAllRooms = (_, res) => {
    const list = Object.keys(rooms).map(getRoomInfo);
    res.json({ rooms: list });
};

export const getRoomById = (req, res) => {
    const room = getRoomInfo(req.params.roomId);
    if (!rooms[req.params.roomId]) {
        return res.status(404).json({ error: "Room not found" });
    }
    res.json(room);
};