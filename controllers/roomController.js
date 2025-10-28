const { rooms } = require("../socket/roomHandlers");
const { getRoomInfo } = require("../utils/helpers");

exports.getAllRooms = (req, res) => {
    const list = Object.keys(rooms).map((id) => getRoomInfo(id, rooms));
    res.json({ rooms: list });
};

exports.getRoomById = (req, res) => {
    const { roomId } = req.params;
    const room = getRoomInfo(roomId, rooms);
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(room);
};
