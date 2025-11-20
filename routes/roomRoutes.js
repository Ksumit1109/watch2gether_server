// server/routes/roomRoutes.js
import express from "express";
import { getAllRooms, getRoomById } from "../controllers/roomController.js";

const router = express.Router();

router.get("/", getAllRooms);
router.get("/:roomId", getRoomById);

export default router;