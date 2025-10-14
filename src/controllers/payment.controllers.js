import mongoose from "mongoose";
import crypto from "node:crypto";
import { Payment } from "../models/payment.model.js";
import { Booking } from "../models/booking.model.js";
import { ChargingSession } from "../models/chargingSession.model.js";
import { ApiError } from "../utility/ApiError.js";
import { ApiResponse } from "../utility/ApiResponse.js";
import { asyncHandler } from "../utility/asyncHandler.js";

const ensureValidObjectId = (id, message) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, message);
  }
};

const resolveBookingContext = async (bookingId, userId) => {
  if (!bookingId) return null;
  ensureValidObjectId(bookingId, "Invalid booking ID");
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.userID.toString() !== userId.toString()) {
    throw new ApiError(404, "Booking not found for this user");
  }
  return booking;
};

const resolveSessionContext = async (sessionId, userId) => {
  if (!sessionId) return null;
  ensureValidObjectId(sessionId, "Invalid charging session ID");
  const session = await ChargingSession.findById(sessionId);
  if (!session || session.userId.toString() !== userId.toString()) {
    throw new ApiError(404, "Charging session not found for this user");
  }
  return session;
};

const computeDefaultAmount = (booking, paymentType) => {
  if (!booking) return 0;
  if (paymentType === "booking") {
    const estimate = booking.pricing?.totalCost ?? booking.pricing?.estimatedCost;
    return typeof estimate === "number" && estimate > 0 ? estimate : 0;
  }
  if (paymentType === "charging") {
    const actual = booking.pricing?.actualCost;
    if (typeof actual === "number" && actual > 0) {
      return actual;
    }
  }
  return 0;
};

const generateProviderPaymentId = () =>
  `PRV-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

const initiatePayment = asyncHandler(async (req, res) => {
  const {
    bookingId,
    sessionId,
    amount,
    currency = "INR",
    paymentMethod,
    providerName,
    providerPaymentId,
    providerOrderId,
    paymentType = "booking",
    breakdown = {},
    metadata = {},
    coupon,
    billing,
  } = req.body ?? {};

  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!paymentMethod || !providerName) {
    throw new ApiError(400, "paymentMethod and providerName are required");
  }

  if (!bookingId && !sessionId) {
    throw new ApiError(400, "Provide either bookingId or sessionId");
  }

  const booking = await resolveBookingContext(bookingId, userId);
  const session = await resolveSessionContext(sessionId, userId);

  if (booking && booking.paymentStatus === "paid") {
    throw new ApiError(409, "Booking is already paid");
  }

  const resolvedAmount = Number(amount ?? computeDefaultAmount(booking, paymentType));
  if (Number.isNaN(resolvedAmount) || resolvedAmount <= 0) {
    throw new ApiError(400, "A valid positive amount is required");
  }

  if (session && session.status !== "charging" && session.status !== "completed") {
    throw new ApiError(400, "Charging session is not ready for payment");
  }

  const payment = await Payment.create({
    userId,
    bookingId: booking?._id,
    sessionId: session?._id,
    paymentType,
    amount: resolvedAmount,
    currency,
    paymentMethod,
    provider: {
      name: providerName,
      paymentId: providerPaymentId ?? generateProviderPaymentId(),
      orderId: providerOrderId ?? undefined,
    },
    breakdown,
    metadata,
    billing,
    coupon,
    status: "initiated",
  });

  if (booking) {
    booking.paymentMethod = paymentMethod;
    booking.paymentStatus = "pending";
    booking.transactionID = payment.provider.paymentId;
    await booking.save();
  }

  return res
    .status(201)
    .json(new ApiResponse(201, payment, "Payment initiated successfully"));
});

const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const {
    status,
    providerPaymentId,
    providerSignature,
    verificationMethod,
    amountPaid,
    failureCode,
    failureMessage,
  } = req.body ?? {};

  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  ensureValidObjectId(paymentId, "Invalid payment ID");

  const payment = await Payment.findById(paymentId);
  if (!payment || payment.userId.toString() !== userId.toString()) {
    throw new ApiError(404, "Payment not found for this user");
  }

  if (!status || !["success", "failed", "processing"].includes(status)) {
    throw new ApiError(400, "Invalid status value");
  }

  if (providerPaymentId) {
    payment.provider.paymentId = providerPaymentId;
  }
  if (providerSignature) {
    payment.provider.signature = providerSignature;
  }

  if (verificationMethod) {
    payment.verification.isVerified = status === "success";
    payment.verification.verificationMethod = verificationMethod;
    payment.verification.verifiedAt = status === "success" ? new Date() : undefined;
  }

  if (amountPaid !== undefined) {
    const paidAmount = Number(amountPaid);
    if (Number.isNaN(paidAmount) || paidAmount <= 0) {
      throw new ApiError(400, "amountPaid must be a positive number");
    }
    payment.amount = paidAmount;
  }

  if (status === "failed") {
    payment.markAsFailed(failureCode ?? "PAYMENT_FAILED", failureMessage ?? "Payment failed");
  } else {
    payment.status = status;
  }

  await payment.save();

  const booking = payment.bookingId ? await Booking.findById(payment.bookingId) : null;
  const session = payment.sessionId ? await ChargingSession.findById(payment.sessionId) : null;

  if (booking) {
    if (status === "success") {
      booking.paymentStatus = "paid";
      booking.paymentMethod = payment.paymentMethod;
      booking.transactionID = payment.provider.paymentId;
      booking.pricing = {
        ...booking.pricing,
        actualCost: payment.amount,
        totalCost: payment.amount,
      };
    } else if (status === "failed") {
      booking.paymentStatus = "failed";
    } else {
      booking.paymentStatus = "processing";
    }
    await booking.save();
  }

  if (session && status === "success" && payment.paymentType === "charging") {
    session.totalCost = payment.amount;
    await session.save();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, payment, "Payment status updated successfully"));
});

const initiateRefund = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { amount, reason } = req.body ?? {};

  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  ensureValidObjectId(paymentId, "Invalid payment ID");

  const payment = await Payment.findById(paymentId);
  if (!payment || payment.userId.toString() !== userId.toString()) {
    throw new ApiError(404, "Payment not found for this user");
  }

  try {
    payment.initiateRefund(amount ? Number(amount) : undefined, reason, "user");
  } catch (error) {
    throw new ApiError(400, error.message);
  }

  await payment.save();

  if (payment.bookingId) {
    const booking = await Booking.findById(payment.bookingId);
    if (booking) {
      booking.paymentStatus = payment.status === "refunded" ? "refunded" : "partial";
      await booking.save();
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, payment, "Refund initiated successfully"));
});

const getUserPayments = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const { status, paymentType } = req.query ?? {};

  const filters = { userId };
  if (status) {
    filters.status = status;
  }
  if (paymentType) {
    filters.paymentType = paymentType;
  }

  const payments = await Payment.find(filters).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, payments, "Payments fetched successfully"));
});

const getPaymentDetails = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  ensureValidObjectId(paymentId, "Invalid payment ID");

  const payment = await Payment.findOne({ _id: paymentId, userId })
    .populate("bookingId")
    .populate("sessionId");

  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, payment, "Payment details fetched successfully"));
});

export {
  initiatePayment,
  verifyPayment,
  initiateRefund,
  getUserPayments,
  getPaymentDetails,
};
