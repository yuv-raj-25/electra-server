import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
	startChargingSession,
	updateChargingSessionMetrics,
	completeChargingSession,
	getUserChargingSessions,
	getChargingSessionDetails,
} from "../controllers/chargingSession.controllers.js";

const router = Router();

router.post("/start", verifyJWT, startChargingSession);
router.patch("/:sessionId", verifyJWT, updateChargingSessionMetrics);
router.post("/:sessionId/complete", verifyJWT, completeChargingSession);
router.get("/", verifyJWT, getUserChargingSessions);
router.get("/:sessionId", verifyJWT, getChargingSessionDetails);

export default router;
