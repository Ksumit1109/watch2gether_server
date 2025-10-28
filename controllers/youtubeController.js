const fetch = require("node-fetch");
const YT_KEY = process.env.YOUTUBE_API_KEY;

exports.searchYouTube = async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing query param q" });

    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(
        q
    )}&key=${YT_KEY}`;

    try {
        const r = await fetch(apiUrl);
        const data = await r.json();
        res.json(data);
    } catch (err) {
        console.error("YouTube API error:", err);
        res.status(500).json({ error: "YouTube API error" });
    }
};
