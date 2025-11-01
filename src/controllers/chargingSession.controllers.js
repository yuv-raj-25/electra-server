import crypto from "node:crypto";
import mongoose from "mongoose";
import { ChargingSession } from "../models/chargingSession.model.js";
import { Booking } from "../models/booking.model.js";
import { Station } from "../models/station.model.js";
import { asyncHandler } from "../utility/asyncHandler.js";
import { ApiError } from "../utility/ApiError.js";
import { ApiResponse } from "../utility/ApiResponse.js";

const ACTIVE_SESSION_STATUSES = [
	"initiated",
	"authenticating",
	"starting",
	"charging",
	"paused",
	"resuming",
	"stopping",
];

const generateSessionCode = () =>
	`SES-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

const ensureValidObjectId = (id, message) => {
	if (!mongoose.Types.ObjectId.isValid(id)) {
		throw new ApiError(400, message);
	}
};

const startChargingSession = asyncHandler(async (req, res) => {
	const { bookingId, initialSOC, targetSOC } = req.body ?? {};
	const userId = req.user?._id;

	if (!userId || !bookingId || initialSOC === undefined || targetSOC === undefined) {
		throw new ApiError(400, "bookingId, initialSOC, and targetSOC are required");
	}

	ensureValidObjectId(bookingId, "Invalid booking ID");

	const initial = Number(initialSOC);
	const target = Number(targetSOC);

	if ([initial, target].some((value) => Number.isNaN(value) || value < 0 || value > 100)) {
		throw new ApiError(400, "SOC values must be numbers between 0 and 100");
	}

	if (initial >= target) {
		throw new ApiError(400, "targetSOC must be greater than initialSOC");
	}

	const booking = await Booking.findById(bookingId);
	if (!booking || booking.userID.toString() !== userId.toString()) {
		throw new ApiError(404, "Booking not found for this user");
	}

	if (!booking.plugType) {
		throw new ApiError(400, "Booking is missing plug selection");
	}

	if (![
		"pending",
		"confirmed",
		"active",
	].includes(booking.status)) {
		throw new ApiError(400, "Booking is not eligible for starting a charging session");
	}

	const station = await Station.findById(booking.stationID);
	if (!station) {
		throw new ApiError(404, "Station linked to booking not found");
	}

	const plug = station.plugs?.find((p) => p.type === booking.plugType);
	if (!plug) {
		throw new ApiError(400, "Selected plug type is no longer available at this station");
	}

	if (!plug.availability) {
		throw new ApiError(400, "Selected plug is currently unavailable");
	}

	const activeSession = await ChargingSession.findOne({
		bookingId,
		status: { $in: ACTIVE_SESSION_STATUSES },
	});

	if (activeSession) {
		throw new ApiError(409, "An active charging session already exists for this booking");
	}

	const session = await ChargingSession.create({
		sessionCode: generateSessionCode(),
		bookingId: booking._id,
		userId: booking.userID,
		stationId: booking.stationID,
		status: "starting",
		chargingData: {
			initialSOC: initial,
			currentSOC: initial,
			targetSOC: target,
			kWhConsumed: 0,
			currentPower: plug.powerKW ?? 0,
			maxPower: plug.powerKW ?? 0,
			averagePower: plug.powerKW ?? 0,
		},
		kWhConsumed: 0,
		durationMinutes: 0,
		totalCost: 0,
	});

	booking.status = "active";
	await booking.save();

	return res
		.status(201)
		.json(new ApiResponse(201, session, "Charging session started successfully"));
});

const updateChargingSessionMetrics = asyncHandler(async (req, res) => {
	const { sessionId } = req.params;
	const { currentSOC, kWhConsumed, currentPower, voltage, current, temperature, status } =
		req.body ?? {};
	const userId = req.user?._id;

	ensureValidObjectId(sessionId, "Invalid session ID");

	const session = await ChargingSession.findById(sessionId);
	if (!session || session.userId.toString() !== userId.toString()) {
		throw new ApiError(404, "Charging session not found for this user");
	}

	if (session.status === "completed" || session.status === "failed") {
		throw new ApiError(400, "Cannot update a finished charging session");
	}

	if (status) {
		if (!ACTIVE_SESSION_STATUSES.includes(status) && status !== "charging" && status !== "paused") {
			throw new ApiError(400, "Invalid session status transition");
		}
		session.status = status;
	}

	const data = session.chargingData || {};

	if (currentSOC !== undefined) {
		const soc = Number(currentSOC);
		if (Number.isNaN(soc) || soc < 0 || soc > 100) {
			throw new ApiError(400, "currentSOC must be between 0 and 100");
		}
		data.currentSOC = soc;
	}

	if (kWhConsumed !== undefined) {
		const energy = Number(kWhConsumed);
		if (Number.isNaN(energy) || energy < 0) {
			throw new ApiError(400, "kWhConsumed must be a non-negative number");
		}
		data.kWhConsumed = energy;
		session.kWhConsumed = energy;
	}

	if (currentPower !== undefined) {
		const power = Number(currentPower);
		if (Number.isNaN(power) || power < 0) {
			throw new ApiError(400, "currentPower must be a non-negative number");
		}
		data.currentPower = power;
	}

	if (voltage !== undefined) {
		const safeVoltage = Number(voltage);
		if (Number.isNaN(safeVoltage) || safeVoltage < 0) {
			throw new ApiError(400, "voltage must be a non-negative number");
		}
		data.voltage = safeVoltage;
	}

	if (current !== undefined) {
		const safeCurrent = Number(current);
		if (Number.isNaN(safeCurrent) || safeCurrent < 0) {
			throw new ApiError(400, "current must be a non-negative number");
		}
		data.current = safeCurrent;
	}

	if (temperature !== undefined) {
		const safeTemperature = Number(temperature);
		if (Number.isNaN(safeTemperature)) {
			throw new ApiError(400, "temperature must be a number");
		}
		data.temperature = safeTemperature;
	}

	session.chargingData = data;

	await session.save();

	return res
		.status(200)
		.json(new ApiResponse(200, session, "Charging session updated successfully"));
});

const completeChargingSession = asyncHandler(async (req, res) => {
	const { sessionId } = req.params;
	const { finalSOC, kWhConsumed, totalCost, durationMinutes } = req.body ?? {};
	const userId = req.user?._id;

	ensureValidObjectId(sessionId, "Invalid session ID");

	const session = await ChargingSession.findById(sessionId);
	if (!session || session.userId.toString() !== userId.toString()) {
		throw new ApiError(404, "Charging session not found for this user");
	}

	if (session.status === "completed") {
		throw new ApiError(400, "Charging session already completed");
	}

	const finalSocValue = Number(finalSOC ?? session.chargingData?.currentSOC ?? session.chargingData?.targetSOC);
	if (Number.isNaN(finalSocValue) || finalSocValue < 0 || finalSocValue > 100) {
		throw new ApiError(400, "finalSOC must be between 0 and 100");
	}

	const energy = Number(kWhConsumed ?? session.chargingData?.kWhConsumed ?? 0);
	if (Number.isNaN(energy) || energy < 0) {
		throw new ApiError(400, "kWhConsumed must be a non-negative number");
	}

	const cost = Number(totalCost ?? session.totalCost ?? 0);
	if (Number.isNaN(cost) || cost < 0) {
		throw new ApiError(400, "totalCost must be a non-negative number");
	}

	const duration = durationMinutes !== undefined ? Number(durationMinutes) : session.durationMinutes;
	if (duration !== undefined && (Number.isNaN(duration) || duration < 0)) {
		throw new ApiError(400, "durationMinutes must be a non-negative number when provided");
	}

	session.status = "completed";
	session.chargingData = {
		...(session.chargingData ?? {}),
		finalSOC: finalSocValue,
		currentSOC: finalSocValue,
		kWhConsumed: energy,
	};
	session.kWhConsumed = energy;
	session.totalCost = cost;
	if (duration !== undefined) {
		session.durationMinutes = duration;
	}

	await session.save();

	const booking = await Booking.findById(session.bookingId);
	if (booking) {
		booking.status = "completed";
		booking.pricing.actualCost = cost;
		booking.pricing.totalCost = cost;
		booking.pricing.tax = booking.pricing.tax ?? 0;
		booking.pricing.serviceFee = booking.pricing.serviceFee ?? 0;
		booking.pricing.discount = booking.pricing.discount ?? 0;
		if (booking.pricing.ratePerKWh > 0 && energy > 0) {
			booking.pricing.estimatedCost = Number((energy * booking.pricing.ratePerKWh).toFixed(2));
		}
		booking.paymentStatus = cost > 0 ? "paid" : booking.paymentStatus;
		await booking.save();
	}

		const station = await Station.findById(session.stationId);
		if (station) {
			const currentPorts = typeof station.availablePorts === "number" ? station.availablePorts : 0;
			const capacity = typeof station.capacity === "number" ? station.capacity : currentPorts;
			station.availablePorts = Math.min(currentPorts + 1, capacity ?? currentPorts + 1);
			await station.save();
		}

	return res
		.status(200)
		.json(new ApiResponse(200, session, "Charging session completed successfully"));
});

const getUserChargingSessions = asyncHandler(async (req, res) => {
	const userId = req.user?._id;
	const { status } = req.query ?? {};

	const filters = { userId };
	if (status) {
		filters.status = status;
	}

	const sessions = await ChargingSession.find(filters).sort({ createdAt: -1 });

	return res
		.status(200)
		.json(new ApiResponse(200, sessions, "Charging sessions fetched successfully"));
});

const getChargingSessionDetails = asyncHandler(async (req, res) => {
	const { sessionId } = req.params;
	const userId = req.user?._id;

	ensureValidObjectId(sessionId, "Invalid session ID");

	const session = await ChargingSession.findOne({ _id: sessionId, userId })
		.populate("bookingId")
		.populate("stationId");

	if (!session) {
		throw new ApiError(404, "Charging session not found");
	}

	return res
		.status(200)
		.json(new ApiResponse(200, session, "Charging session details fetched successfully"));
});

export {
	startChargingSession,
	updateChargingSessionMetrics,
	completeChargingSession,
	getUserChargingSessions,
	getChargingSessionDetails,
};
