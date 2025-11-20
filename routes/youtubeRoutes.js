// server/routes/youtubeRoutes.js
import express from "express";
import { searchYouTube } from "../controllers/youtubeController.js";

const router = express.Router();
router.get("/", searchYouTube);
export default router;