function getRoomInfo(roomId, rooms) {
    const room = rooms[roomId];
    if (!room) return null;
    return {
        roomId,
        host: room.host,
        memberCount: room.members.size,
        members: Array.from(room.members, ([id, info]) => ({
            id,
            username: info.username,
            isHost: room.host === id,
        })),
    };
}

module.exports = { getRoomInfo };
