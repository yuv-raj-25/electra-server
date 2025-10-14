import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  initiatePayment,
  verifyPayment,
  initiateRefund,
  getUserPayments,
  getPaymentDetails,
} from "../controllers/payment.controllers.js";

const router = Router();

router.post("/initiate", verifyJWT, initiatePayment);
router.patch("/:paymentId", verifyJWT, verifyPayment);
router.post("/:paymentId/refund", verifyJWT, initiateRefund);
router.get("/", verifyJWT, getUserPayments);
router.get("/:paymentId", verifyJWT, getPaymentDetails);

export default router;
