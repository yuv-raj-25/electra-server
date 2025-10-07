import mongoose, { Schema, model } from "mongoose";

const reviewSchema = new Schema({
  userId: {
     type: mongoose.Schema.Types.ObjectId,
     ref: "User" 
    },
  stationId: {
     type: mongoose.Schema.Types.ObjectId,
     ref: "Station"
    },
  rating: { 
    type: Number,
    min: 1,
    max: 5
  },
  comment: String,
}, { timestamps: true });

export const Review = model("Review", reviewSchema);
