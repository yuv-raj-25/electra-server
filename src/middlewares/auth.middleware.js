import jwt from "jsonwebtoken";
import {ApiError} from "../utility/ApiError.js"
import {asyncHandler} from "../utility/asyncHandler.js";
import {User }from "../models/user.model.js";


// protect middleware

export const verifyJWT = asyncHandler(async(req , res , next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer " , "")
        if(!token){
            throw new ApiError(401 , "Unauthorized request , No token provided")
        }
       const decodedToken =  jwt.verify(token , process.env.ACCESS_TOKEN_SECRET )

       const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
       if(!user){
        throw new ApiError(401 , "Invalid Access Token , User not found ")
       }

       req.user = user;
       next()
        
    } catch (error) {
        throw new ApiError(401 , error?.message || "Invalid Token , Please login again")
        
    }
})
