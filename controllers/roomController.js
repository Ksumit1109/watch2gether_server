import * as db from '../db/queries.js';

export const getAllRooms = async (_, res) => {
    try {
        const rooms = await db.getAllActiveRooms();
        res.json({ rooms });
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
};

export const getRoomById = async (req, res) => {
    try {
        const room = await db.getRoom(req.params.roomId);
        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        const memberCount = await db.getRoomMemberCount(req.params.roomId);

        res.json({
            id: room.id,
            host: room.host_socket_id,
            members: memberCount,
            createdAt: room.created_at
        });
    } catch (error) {
        console.error('Error fetching room:', error);
        res.status(500).json({ error: 'Failed to fetch room' });
    }
};