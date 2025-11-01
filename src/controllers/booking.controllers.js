import { Booking } from "../models/booking.model.js";
import { asyncHandler } from "../utility/asyncHandler.js";
import { ApiError } from "../utility/ApiError.js";
import { ApiResponse } from "../utility/ApiResponse.js";
import { Station } from "../models/station.model.js";


// Create a new booking controller

const createBooking = asyncHandler(async (req, res) => {
    const { stationId, startTime, endTime, vehicle, plugType } = req.body;
    const userId = req.user?._id; // from protect middleware

    if (!userId || !stationId || !startTime || !endTime || !vehicle || !plugType) {
        throw new ApiError(400, "All fields are required");
    }

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedEndTime.getTime())) {
        throw new ApiError(400, "Invalid date format for start or end time");
    }

    if (parsedStartTime >= parsedEndTime) {
        throw new ApiError(400, "Invalid booking time");
    }

    const station = await Station.findById(stationId);
    if (!station) {
        throw new ApiError(404, "Station not found");
    }

    if (!Array.isArray(station.plugs) || station.plugs.length === 0) {
        throw new ApiError(400, "Station has no plug configuration");
    }

    const plug = station.plugs.find((p) => p.type === plugType);
    if (!plug) {
        throw new ApiError(400, "Selected plug type not available at this station");
    }

    const availablePorts = typeof station.availablePorts === "number"
        ? station.availablePorts
        : typeof station.capacity === "number"
            ? station.capacity
            : 0;

    if (availablePorts <= 0) {
        throw new ApiError(400, "No available charging ports at this station");
    }

    const overlappingBooking = await Booking.findOne({
        stationID: stationId,
        $or: [
            { startTime: { $lt: parsedEndTime, $gte: parsedStartTime } },
            { endTime: { $gt: parsedStartTime, $lte: parsedEndTime } },
            { startTime: { $lte: parsedStartTime }, endTime: { $gte: parsedEndTime } },
        ],
    });

    if (overlappingBooking) {
        throw new ApiError(409, "The selected time slot is already booked");
    }

    if (!plug.availability) {
        throw new ApiError(400, "Selected plug is currently unavailable");
    }

    const ratePerKWh = plug.pricePerKWh;
    if (typeof ratePerKWh !== "number" || ratePerKWh < 0) {
        throw new ApiError(400, "Station rate per kWh is not configured correctly");
    }

    const powerKW = plug.powerKW;
    if (typeof powerKW !== "number" || powerKW <= 0) {
        throw new ApiError(400, "Station power rating is not configured correctly");
    }

    const durationHours = Math.max((parsedEndTime - parsedStartTime) / (1000 * 60 * 60), 0);
    const estimatedEnergy = durationHours * powerKW;
    const estimatedCost = Number((estimatedEnergy * ratePerKWh).toFixed(2));

    const booking = await Booking.create({
        userID: userId,
        stationID: stationId,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        vehicle,
        plugType,
        status: "pending",
        pricing: {
            ratePerKWh,
            estimatedCost,
            actualCost: estimatedCost,
            tax: 0,
            serviceFee: 0,
            discount: 0,
            totalCost: estimatedCost,
        },
    });

    station.availablePorts = availablePorts - 1;
    await station.save();

    return res
        .status(201)
        .json(new ApiResponse(201, booking, "Booking created successfully"));
});


const cancelBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { reason } = req.body ?? {};
    const userId = req.user?._id; // from protect middleware

    if (!bookingId) {
        throw new ApiError(400, "Booking ID is required");
    }

    const booking = await Booking.findOne({ _id: bookingId, userID: userId });
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    if (!booking.canBeCancelled()) {
        throw new ApiError(400, "Booking can no longer be cancelled");
    }

    booking.status = "cancelled";
    booking.cancellation = {
        cancelledBy: "user",
        cancelledAt: new Date(),
        reason: (reason ?? "Cancelled by user").toString().slice(0, 500),
        refundAmount: booking.calculateRefund(),
        refundStatus: "pending",
    };

    await booking.save();

    const station = await Station.findById(booking.stationID);
    if (station) {
        const currentPorts = typeof station.availablePorts === "number" ? station.availablePorts : 0;
        const capacity = typeof station.capacity === "number" ? station.capacity : currentPorts;
        station.availablePorts = Math.min(currentPorts + 1, capacity ?? currentPorts + 1);
        await station.save();
    }

    return res.status(200).json(new ApiResponse(200, booking, "Booking cancelled successfully"));
});



export {
    createBooking,
    cancelBooking
}