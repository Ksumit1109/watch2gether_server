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

        // Create indexes
        await sql`CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at)`;

        console.log('✓ Database schema initialized');
    } catch (error) {
        console.error('✗ Database initialization failed:', error);
        throw error;
    }
}