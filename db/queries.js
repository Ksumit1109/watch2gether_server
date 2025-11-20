import { sql } from './config.js';

// Room operations
export async function createRoom(roomId, hostSocketId) {
    const result = await sql`
    INSERT INTO rooms (id, host_socket_id)
    VALUES (${roomId}, ${hostSocketId})
    RETURNING *
  `;
    return result[0];
}

export async function getRoom(roomId) {
    const result = await sql`
    SELECT * FROM rooms WHERE id = ${roomId}
  `;
    return result[0];
}

export async function deleteRoom(roomId) {
    await sql`DELETE FROM rooms WHERE id = ${roomId}`;
}

export async function updateRoomHost(roomId, newHostSocketId) {
    await sql`
    UPDATE rooms 
    SET host_socket_id = ${newHostSocketId}, updated_at = NOW()
    WHERE id = ${roomId}
  `;
}

export async function updateRoomState(roomId, videoId, videoState) {
    await sql`
    UPDATE rooms 
    SET video_id = ${videoId}, 
        video_state = ${JSON.stringify(videoState)},
        updated_at = NOW()
    WHERE id = ${roomId}
  `;
}

// Member operations
export async function addRoomMember(roomId, socketId, username) {
    const result = await sql`
    INSERT INTO room_members (room_id, socket_id, username)
    VALUES (${roomId}, ${socketId}, ${username})
    ON CONFLICT (room_id, socket_id) 
    DO UPDATE SET username = ${username}
    RETURNING *
  `;
    return result[0];
}

export async function removeMember(socketId) {
    await sql`DELETE FROM room_members WHERE socket_id = ${socketId}`;
}

export async function getRoomMembers(roomId) {
    return await sql`
    SELECT socket_id, username, joined_at
    FROM room_members
    WHERE room_id = ${roomId}
    ORDER BY joined_at ASC
  `;
}

export async function getRoomMemberCount(roomId) {
    const result = await sql`
    SELECT COUNT(*) as count
    FROM room_members
    WHERE room_id = ${roomId}
  `;
    return parseInt(result[0].count);
}

// Chat operations
export async function saveChatMessage(roomId, username, message) {
    const result = await sql`
    INSERT INTO chat_messages (room_id, username, message)
    VALUES (${roomId}, ${username}, ${message})
    RETURNING *
  `;
    return result[0];
}

export async function getChatHistory(roomId, limit = 50) {
    return await sql`
    SELECT username, message, created_at
    FROM chat_messages
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

// Cleanup old rooms
export async function cleanupOldRooms(hoursOld = 24) {
    await sql`
    DELETE FROM rooms
    WHERE created_at < NOW() - INTERVAL '${hoursOld} hours'
  `;
}

// Get all active rooms
export async function getAllActiveRooms() {
    return await sql`
    SELECT 
      r.id,
      r.host_socket_id,
      r.created_at,
      COUNT(rm.id) as member_count
    FROM rooms r
    LEFT JOIN room_members rm ON r.id = rm.room_id
    GROUP BY r.id, r.host_socket_id, r.created_at
    ORDER BY r.created_at DESC
  `;
}