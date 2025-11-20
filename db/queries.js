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


// YouTube Search operations
export async function saveSearchQuery(query, maxResults, roomId = null, username = null, resultsCount = 0) {
    const result = await sql`
    INSERT INTO search_queries (query, max_results, room_id, username, results_count)
    VALUES (${query}, ${maxResults}, ${roomId}, ${username}, ${resultsCount})
    RETURNING *
  `;
    return result[0];
}

export async function saveVideoSearchResults(searchQueryId, videos) {
    if (!videos || videos.length === 0) return;

    const values = videos.map(video => ({
        search_query_id: searchQueryId,
        video_id: video.id.videoId,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail_url: video.snippet.thumbnails?.default?.url || null,
        channel_title: video.snippet.channelTitle,
        published_at: video.snippet.publishedAt
    }));

    for (const video of values) {
        await sql`
      INSERT INTO video_searches (
        search_query_id, video_id, title, description, 
        thumbnail_url, channel_title, published_at
      )
      VALUES (
        ${video.search_query_id}, 
        ${video.video_id}, 
        ${video.title}, 
        ${video.description},
        ${video.thumbnail_url}, 
        ${video.channel_title}, 
        ${video.published_at}
      )
    `;
    }
}

export async function getRecentSearches(limit = 10) {
    return await sql`
    SELECT 
      query, 
      COUNT(*) as search_count,
      MAX(created_at) as last_searched
    FROM search_queries
    GROUP BY query
    ORDER BY last_searched DESC
    LIMIT ${limit}
  `;
}

export async function getPopularSearches(limit = 10) {
    return await sql`
    SELECT 
      query, 
      COUNT(*) as search_count,
      MAX(created_at) as last_searched
    FROM search_queries
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY query
    ORDER BY search_count DESC, last_searched DESC
    LIMIT ${limit}
  `;
}

export async function getCachedSearchResults(query, maxResults, cacheMinutes = 60) {
    const result = await sql`
    SELECT 
      sq.id as search_query_id,
      sq.created_at,
      json_agg(
        json_build_object(
          'id', json_build_object('videoId', vs.video_id),
          'snippet', json_build_object(
            'title', vs.title,
            'description', vs.description,
            'thumbnails', json_build_object('default', json_build_object('url', vs.thumbnail_url)),
            'channelTitle', vs.channel_title,
            'publishedAt', vs.published_at
          )
        )
      ) as items
    FROM search_queries sq
    JOIN video_searches vs ON sq.id = vs.search_query_id
    WHERE sq.query = ${query}
      AND sq.max_results >= ${maxResults}
      AND sq.created_at > NOW() - INTERVAL '${cacheMinutes} minutes'
    GROUP BY sq.id, sq.created_at
    ORDER BY sq.created_at DESC
    LIMIT 1
  `;

    return result[0] || null;
}

// Video Play Tracking
export async function trackVideoPlay(roomId, videoId, videoTitle, startedBy) {
    const result = await sql`
    INSERT INTO video_plays (room_id, video_id, video_title, started_by)
    VALUES (${roomId}, ${videoId}, ${videoTitle}, ${startedBy})
    RETURNING *
  `;
    return result[0];
}

export async function getMostPlayedVideos(limit = 10, days = 7) {
    return await sql`
    SELECT 
      video_id,
      video_title,
      COUNT(*) as play_count,
      MAX(started_at) as last_played
    FROM video_plays
    WHERE started_at > NOW() - INTERVAL '${days} days'
    GROUP BY video_id, video_title
    ORDER BY play_count DESC, last_played DESC
    LIMIT ${limit}
  `;
}

export async function getRoomVideoHistory(roomId, limit = 20) {
    return await sql`
    SELECT video_id, video_title, started_by, started_at
    FROM video_plays
    WHERE room_id = ${roomId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
}