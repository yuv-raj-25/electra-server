import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createBooking, cancelBooking } from "../controllers/booking.controllers.js";

const router = Router();

router.route("/").post(verifyJWT, createBooking);
router.route("/:bookingId/cancel").patch(verifyJWT, cancelBooking);

export default router;
