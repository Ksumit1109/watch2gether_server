import { sql } from './config.js';

export async function initDatabase() {
    try {
        // Create rooms table
        await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(6) PRIMARY KEY,
        host_socket_id VARCHAR(255) NOT NULL,
        video_id VARCHAR(255),
        video_state JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

        // Create room_members table
        await sql`
      CREATE TABLE IF NOT EXISTS room_members (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(6) REFERENCES rooms(id) ON DELETE CASCADE,
        socket_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(room_id, socket_id)
      )
    `;

        // Create chat_messages table
        await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(6) REFERENCES rooms(id) ON DELETE CASCADE,
        username VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

        // NEW: Create search_queries table
        await sql`
      CREATE TABLE IF NOT EXISTS search_queries (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        max_results INTEGER DEFAULT 8,
        room_id VARCHAR(6),
        username VARCHAR(255),
        results_count INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

        // NEW: Create video_searches table (stores actual video results)
        await sql`
      CREATE TABLE IF NOT EXISTS video_searches (
        id SERIAL PRIMARY KEY,
        search_query_id INTEGER REFERENCES search_queries(id) ON DELETE CASCADE,
        video_id VARCHAR(255) NOT NULL,
        title TEXT,
        description TEXT,
        thumbnail_url TEXT,
        channel_title VARCHAR(255),
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

        // NEW: Create video_plays table (track what videos are played in rooms)
        await sql`
      CREATE TABLE IF NOT EXISTS video_plays (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(6) REFERENCES rooms(id) ON DELETE SET NULL,
        video_id VARCHAR(255) NOT NULL,
        video_title TEXT,
        started_by VARCHAR(255),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

        // Create indexes
        await sql`CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at)`;

        // NEW: Indexes for search tables
        await sql`CREATE INDEX IF NOT EXISTS idx_search_queries_query ON search_queries(query)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON search_queries(created_at)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_video_searches_video_id ON video_searches(video_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_video_searches_search_query_id ON video_searches(search_query_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_video_plays_room_id ON video_plays(room_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_video_plays_video_id ON video_plays(video_id)`;

        console.log('✓ Database schema initialized');
    } catch (error) {
        console.error('✗ Database initialization failed:', error);
        throw error;
    }
}