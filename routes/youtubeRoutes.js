const express = require("express");
const router = express.Router();
const { searchYouTube } = require("../controllers/youtubeController");

router.get("/", searchYouTube);

module.exports = router;
