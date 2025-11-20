import express from "express";
import {
    searchYouTube,
    getPopularSearches,
    getRecentSearches,
    getMostPlayedVideos
} from "../controllers/youtubeController.js";

const router = express.Router();

// Main search endpoint
router.get("/", searchYouTube);

// Analytics endpoints
router.get("/popular", getPopularSearches);
router.get("/recent", getRecentSearches);
router.get("/most-played", getMostPlayedVideos);

export default router;