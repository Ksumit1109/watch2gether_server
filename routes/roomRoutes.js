const express = require("express");
const router = express.Router();
const { getAllRooms, getRoomById } = require("../controllers/roomController");

router.get("/", getAllRooms);
router.get("/:roomId", getRoomById);

module.exports = router;
