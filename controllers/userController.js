import { sql } from "../db/config.js";

export const syncUser = async (req, res) => {
    const { id, email, username, avatar_url } = req.body;

    if (!id || !email) {
        return res.status(400).json({ error: "User ID and email are required" });
    }

    try {
        const result = await sql`
            INSERT INTO users (id, email, username, avatar_url, updated_at)
            VALUES (${id}, ${email}, ${username}, ${avatar_url}, CURRENT_TIMESTAMP)
            ON CONFLICT (id) 
            DO UPDATE SET 
                email = EXCLUDED.email,
                username = EXCLUDED.username,
                avatar_url = EXCLUDED.avatar_url,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;

        res.status(200).json({ success: true, user: result[0] });
    } catch (error) {
        console.error("Error syncing user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
