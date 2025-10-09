import { Schema, model } from "mongoose";

const stationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Station name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: "EV charging station with multiple plug types",
    },
    location: {
      address: {
        type: String,
        required: [true, "Station address is required"],
        trim: true,
      },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
        },
      },
      city: String,
      state: String,
      zipCode: String,
    },
    capacity: {
      type: Number,
      required: [true, "Capacity is required"],
      min: [0, "Capacity must be a positive number"],
    },
    availablePorts: {
      type: Number,
      default: 0,
      min: [0, "Available ports must be positive"],
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
    },
    plugs: [
      {
        type: {
          type: String,
          enum: ["CCS2", "CHAdeMO", "Type2"],
          required: true,
        },
        powerKW: {
          type: Number,
          required: true,
          min: [1, "Power must be at least 1kW"],
        },
        pricePerKWh: {
          type: Number,
          required: true,
          min: [0, "Price must be positive"],
        },
        availability: { type: Boolean, default: true },
      },
    ],
    amenities: [
      {
        type: String,
        enum: ["Parking", "Restroom", "Cafe", "Food Court", "WiFi", "Lounge"],
      },
    ],
    rating: {
      type: Number,
      min: [0, "Rating must be at least 0"],
      max: [5, "Rating cannot exceed 5"],
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Under Maintenance", "Closed"],
      default: "Active",
    },
    workingHours: {
      open: { type: String, default: "06:00" },
      close: { type: String, default: "22:00" },
    },
    photos: [String], // image URLs from Cloudinary, etc.
  },
  { timestamps: true }
);

stationSchema.index({ "location.coordinates": "2dsphere" }); // geospatial index for map search

export const Station = model("Station", stationSchema);
