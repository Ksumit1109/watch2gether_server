import fetch from "node-fetch";
import dotenv from "dotenv";
import * as db from "../db/queries.js";

dotenv.config();

const YT_KEY = process.env.YOUTUBE_API_KEY;

export const searchYouTube = async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "missing query param q" });

    const maxResults = Math.min(parseInt(req.query.maxResults || "8"), 50);
    const roomId = req.query.roomId || null;
    const username = req.query.username || null;
    const useCache = req.query.cache !== 'false'; // Enable cache by default

    try {
        // Check cache first (if enabled)
        if (useCache) {
            const cachedResults = await db.getCachedSearchResults(q, maxResults, 60);
            if (cachedResults) {
                console.log(`✓ Cache hit for query: "${q}"`);
                return res.json({
                    items: cachedResults.items,
                    cached: true,
                    cachedAt: cachedResults.created_at
                });
            }
        }

        // Fetch from YouTube API
        const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(q)}&key=${YT_KEY}`;
        const r = await fetch(apiUrl);
        const data = await r.json();

        // Check for API errors
        if (data.error) {
            console.error("YouTube API error:", data.error);
            return res.status(data.error.code || 500).json({
                error: data.error.message || "YouTube API error"
            });
        }

        // Save search query to database
        const resultsCount = data.items?.length || 0;
        const searchQuery = await db.saveSearchQuery(
            q,
            maxResults,
            roomId,
            username,
            resultsCount
        );

        // Save video results
        if (data.items && data.items.length > 0) {
            await db.saveVideoSearchResults(searchQuery.id, data.items);
            console.log(`✓ Saved ${resultsCount} search results for: "${q}"`);
        }

        res.json({
            ...data,
            cached: false
        });
    } catch (err) {
        console.error("YouTube API error:", err);
        res.status(500).json({ error: "youtube api error" });
    }
};

// NEW: Get popular searches
export const getPopularSearches = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "10"), 50);
        const searches = await db.getPopularSearches(limit);
        res.json({ searches });
    } catch (err) {
        console.error("Error fetching popular searches:", err);
        res.status(500).json({ error: "Failed to fetch popular searches" });
    }
};

// NEW: Get recent searches
export const getRecentSearches = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "10"), 50);
        const searches = await db.getRecentSearches(limit);
        res.json({ searches });
    } catch (err) {
        console.error("Error fetching recent searches:", err);
        res.status(500).json({ error: "Failed to fetch recent searches" });
    }
};

// NEW: Get most played videos
export const getMostPlayedVideos = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "10"), 50);
        const days = Math.min(parseInt(req.query.days || "7"), 30);
        const videos = await db.getMostPlayedVideos(limit, days);
        res.json({ videos });
    } catch (err) {
        console.error("Error fetching most played videos:", err);
        res.status(500).json({ error: "Failed to fetch most played videos" });
    }
};