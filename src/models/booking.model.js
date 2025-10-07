import mongoose, { Schema, model } from "mongoose";

const bookingSchema = new Schema(
  {
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "active", "completed", "cancelled"],
      default: "pending",
    },
    pricing: {
      ratePerKWh: { type: Number, required: true, min: 0 },
      estimatedCost: { type: Number, required: true, min: 0 },
      actualCost: { type: Number, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      serviceFee: { type: Number, default: 0, min: 0 },
      totalCost: { type: Number, min: 0 },
      currency: { type: String, default: "INR", uppercase: true },
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "partial"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["card", "wallet", "upi", "netbanking", "cash"],
      required: function () {
        return this.paymentStatus === "paid";
      },
    },
    transactionID: {
      type: String,
      sparse: true,
      index: true,
    },
    cancellation: {
      cancelledBy: {
        type: String,
        enum: ["user", "admin", "system"],
      },
      cancelledAt: Date,
      reason: { type: String, maxlength: 500 },
      refundAmount: { type: Number, min: 0 },
      refundStatus: {
        type: String,
        enum: ["pending", "processed", "failed"],
      },
    },
  },
  { timestamps: true }
);

// ⏱ Pre-save: duration.   Pre-save middleware to generate booking code
bookingSchema.pre("save", function (next) {
  if (this.startTime && this.endTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  next();
});

// 💰 Pre-save: total cost.    Pre-save middleware to calculate total cost
bookingSchema.pre("save", function (next) {
  if (this.pricing && this.pricing.actualCost !== undefined) {
    this.pricing.totalCost =
      (this.pricing.actualCost || 0) +
      (this.pricing.tax || 0) +
      (this.pricing.serviceFee || 0) -
      (this.pricing.discount || 0);
  }
  next();
});

// 🔄 Can be cancelled    // Method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function () {
  const now = new Date();
  const hoursTillStart = (this.startTime - now) / (1000 * 60 * 60);
  return (
    (this.status === "pending" || this.status === "confirmed") &&
    hoursTillStart > 1
  );
};

// 💸 Refund calculator.  / Method to calculate refund amount
bookingSchema.methods.calculateRefund = function () {
  const now = new Date();
  const hoursTillStart = (this.startTime - now) / (1000 * 60 * 60);
  if (hoursTillStart > 24)
    return this.pricing.totalCost || this.pricing.estimatedCost;
  if (hoursTillStart > 2)
    return (this.pricing.totalCost || this.pricing.estimatedCost) * 0.5;
  return 0;
};

// 📍 Find active bookings for a station.   // Static method to find active bookings for a station
bookingSchema.statics.findActiveBookings = function (stationID) {
  return this.find({ stationID, status: "active" }).populate(
    "userID",
    "firstName lastName email"
  );
};

// ⏳ Find upcoming bookings for a user.  // Static method to find upcoming bookings for a user
bookingSchema.statics.findUpcomingBookings = function (userID) {
  const now = new Date();
  return this.find({
    userID,
    status: { $in: ["pending", "confirmed"] },
    startTime: { $gte: now },
  }).sort({ startTime: 1 });
};

export const Booking = model("Booking", bookingSchema);
