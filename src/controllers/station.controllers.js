import {asyncHandler} from "../utility/asyncHandler.js";
import {Station} from "../models/station.model.js";
import {ApiError} from "../utility/ApiError.js";
import {ApiResponse} from "../utility/ApiResponse.js";
import mongoose from "mongoose";


// Create a station controller  
// only admin can control the station 
// need the admin to create the station


// adim Only controllers 

const createStation = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    location,
    capacity,
    availablePorts,
    companyName,
    plugs,
    amenities,
    rating,
    totalReviews,
    status,
    workingHours,
    photos,
  } = req.body;
  
  if (!name || !location || !capacity || !companyName || !plugs) {
    throw new ApiError(400, "All required fields must be provided");
  }

  const existingStation = await Station.findOne({
    $or: [{ name }, { "location.address": location.address }],
  });

  if (existingStation) {
    throw new ApiError(409, "Station already exists with this name or address");
  }
  
  const station = await Station.create({
    name,
    description,
    location,
    capacity,
    availablePorts: availablePorts || capacity, // defaults if not given
    companyName,
    plugs,
    amenities,
    rating,
    totalReviews,
    status,
    workingHours,
    photos,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, station, "Station created successfully"));
});


const updateStation = asyncHandler(async (req, res) => {
  const { stationId } = req.params;
  const updateData = req.body;

  //  Validate input
  if (!stationId) {
    throw new ApiError(400, "Station ID is required");
  }

  // Find the station
  const station = await Station.findById(stationId);
  if (!station) {
    throw new ApiError(404, "Station not found");
  }

  // Authorization check
  const isOwner = station.ownerID.toString() === req.user._id.toString();
  const isAdmin = req.user.hasPermission('manage-stations');
    if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You don't have permission to update this station");
  }


  //  Prevent duplicate name or address
  if (updateData.name || (updateData.location && updateData.location.address)) {
    const existingStation = await Station.findOne({
      $or: [
        { name: updateData.name },
        { "location.address": updateData.location?.address },
      ],
      _id: { $ne: stationId }, // exclude current station
    });

    if (existingStation) {
      throw new ApiError(
        409,
        "Another station already exists with this name or address"
      );
    }
  }


  //  If you don’t want `companyName` to be editable after creation

  if (updateData.companyName && updateData.companyName !== station.companyName) {
    throw new ApiError(403, "Company name cannot be changed after creation");
  }

  // Apply updates safely
  Object.assign(station, updateData);

  // Save updated document
  await station.save();

  //  Send success response
  return res
    .status(200)
    .json(new ApiResponse(200, station, "Station updated successfully"));
});


const deleteStation = asyncHandler(async (req, res) => {
  const { stationId } = req.params;
  
  if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
    throw new ApiError(400, "A valid Station ID is required");
  }

  const station = await Station.findById(stationId);
  if (!station) {
    throw new ApiError(404, "Station not found");
  }

  // Authorization check
  // If your middleware doesn't already handle this:
  if (req.user.role !== "admin") {
    throw new ApiError(403, "You are not authorized to delete stations");
  }

  // Check for dependencies smart
  // if bookings exist for this station, prevent deletion
  const existingBookings = await Booking.find({ station: stationId });
  if (existingBookings.length > 0) {
    throw new ApiError(
      400,
      "Cannot delete station with active bookings. Please clear them first."
    );
  }

  //  Perform delete
  const deletedStation = await Station.findByIdAndDelete(stationId);

  //  Handle unexpected failure (rare, but safe)
  if (!deletedStation) {
    throw new ApiError(500, "Failed to delete station due to server issue");
  }

  // Return success response
  return res
    .status(200)
    .json(new ApiResponse(200, deletedStation, "Station deleted successfully"));
});

// public controllers   


const getAllStations = asyncHandler(async (req, res) => {
  const stations = await Station.find();
  return res
    .status(200)
    .json(new ApiResponse(200, stations, "Stations fetched successfully"));
});

const getStationById = asyncHandler(async (req, res) => {
  const { stationId } = req.params;
  
  if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
    throw new ApiError(400, "A valid Station ID is required");
  }

  const station = await Station.findById(stationId);
  if (!station) {
    throw new ApiError(404, "Station not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, station, "Station fetched successfully"));
});





export {
    createStation,
    updateStation,
    deleteStation,
    getAllStations,
    getStationById
    
}
