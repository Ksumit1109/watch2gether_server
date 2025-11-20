import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const YT_KEY = process.env.YOUTUBE_API_KEY;

export const searchYouTube = async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "missing query param q" });
    const maxResults = Math.min(parseInt(req.query.maxResults || "8"), 50);
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(q)}&key=${YT_KEY}`;

    try {
        const r = await fetch(apiUrl);
        const data = await r.json();
        res.json(data);
    } catch (err) {
        console.error("YouTube API error:", err);
        res.status(500).json({ error: "youtube api error" });
    }
};