import User from "../models/user.model.js";
import asyncHandler from "express-async-handler";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";



// register user  controllers


const registerUser = asyncHandler(async (req , res)=> {
    const {userName , email , password , profileImage, vehicle} = req.body;
})
