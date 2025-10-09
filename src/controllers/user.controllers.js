import {User} from "../models/user.model.js";
import {asyncHandler} from "../utility/asyncHandler.js";
import {ApiError} from "../utility/ApiError.js";
import {ApiResponse} from "../utility/ApiResponse.js";
import {uploadOnCloudinary} from "../utility/cloudinary.js";
import jwt from "jsonwebtoken";



const generateAccessTokenAndRefreshToken = async(userId) => { 
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500 , "something went wrong while generating tokens")
    }

}

// register user  controllers
const registerUser = asyncHandler(async (req , res)=> {
    const {userName , email , password , vehicle} = req.body;

    if(
        [userName , email , password].some((field) => field.trim() === "")
    ){
        throw new ApiError(401 , "All the fields are required")
    }
//     if (
//   !vehicle ||
//   !vehicle.make ||
//   !vehicle.model ||
//   !vehicle.year ||
//   !vehicle.licensePlate ||
//   vehicle.make.trim() === "" ||
//   vehicle.model.trim() === "" ||
//   vehicle.year.toString().trim() === "" ||
//   vehicle.licensePlate.trim() === ""
// ) {
//   throw new ApiError(401, "All the vehicle fields (make, model, year, licensePlate) are required");
// }
        // if(isNaN(vehicle.year) || vehicle.year < 1886 || vehicle.year > new Date().getFullYear() + 1) {
        //     throw new ApiError(401, "Please provide a valid vehicle year");
        // }

    // check if user already exists

    const exitedUser = await User.findOne(
        {
            $or: [{userName} , {email}]
        }
    )
    if(exitedUser){
        throw new ApiError(409 , "User already exists with this userName or email")
    }

    const localProfileImage = req.files?.profileImage[0]?.path
    if(!localProfileImage){
        throw new ApiError(402 , "Profile image is required") 
    }
    
    const uploadedProfileImage = await uploadOnCloudinary(localProfileImage) 

    if(!uploadedProfileImage){
        throw new ApiError(500 , "Failed to upload profile image") 
    }

    const user = await User.create({
        userName: userName.toLowerCase(),
        email,
        password,
        profileImage: uploadedProfileImage.secure_url,
        // vehicle
    })
    const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )
  if(!createdUser){
    throw new ApiError(500 , "something went wrong while registering the User")
  }

   return res.status(201).json(
    new ApiResponse(201 , createdUser , "user registration successfully")
  )

})
const assignRole = asyncHandler(async (req , res)=> {

  const { userId, role } = req.body;
  // Only allow valid roles
    if (!["admin", "user"].includes(role)) {
      throw new ApiError(400, "Invalid role specified");
    }
    // Find and update user
    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    );
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const updatedUser = await User.findById(user._id).select("-password -refreshToken");
    return res.status(200).json(
      new ApiResponse(200, updatedUser, "User role updated successfully")
    );
});


// login the user controllers
const loginUser = asyncHandler(async (req , res) => {
    const {userName , password, email} = req.body;

    if ((!userName && !email) || !password) {
         throw new ApiError(400, "Username/email and password are required");
    }
    // console.log(userName, email);
    const user = await User.findOne({
        $or: [{ userName: userName?.toLowerCase() }, { email }],
    });

    if(!user){
        throw new ApiError(404 , "No user found with this userName or email")
    }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if(!isPasswordValid){
    throw new ApiError(401 , "Invalid Password") 
  }
  const {accessToken , refreshToken}= await generateAccessTokenAndRefreshToken(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  if(!loggedInUser){
    throw new ApiError(500 , "something went wrong while login the User")
  }

  const safeUser = {
    id: loggedInUser._id,
    userName: loggedInUser.userName,
    email: loggedInUser.email,
  };

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: safeUser, // Ensure no circular references here
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );

    
})


// logout user controllers

const logoutUser = asyncHandler(async (req , res ) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
      }
      return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(
        new ApiResponse(200 , {} , "User logged out successfully")
      )
})

const changeCurrentPassword = asyncHandler( async (req , res ) => {
    const {oldPassword , newPassword , confirmNewPassword} = req.body;
    
    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(401 , "Old password is incorrect")
    }

    if(newPassword !== confirmNewPassword){
        throw new ApiError(401 , "New password and confirm new password do not match")
    }

    user.password = newPassword;
    await user.save()

    return res
    .status(200)
    .json(
        new ApiResponse(200 , {} , "Password changed successfully")
    )
    
})

const changeProfileImage = asyncHandler(async(req , res) => {
    const localProfileImage = req.files?.path
    if(!localProfileImage){
        throw new ApiError(400 , "Profile image is required")

    }
     // delete the old avatar 
     if (user.profileImage) {
        await deleteFromCloudinary(user.profileImage); 
    }

    const uploadedImage = await uploadOnCloudinary(localProfileImage)

    if(!uploadedImage?.url){
        throw new ApiError(500 , "Failed to upload profile image") 
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
           $set:{
            profileImage: uploadedImage.url
           }
        },
        {
            new: true
        }
    ).select("-password")
    if(!user){
        throw new ApiError(500 , "something went wrong while updating profile image")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200 , user , "Profile Image updated successfully")
    )


})

const getCurrentUser = asyncHandler( async (req , res) => {
  return res
  .status(200)
  .json(
    new ApiResponse(200 , req.user , "Current User fetched Successfully")
  )

})


// refresh access token controllers
const refreshAccessToken  = asyncHandler( async (req ,  res ) => {

  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiError(401 , "unauthorized request ")
  }

 let decodeToken;
  try {
    decodeToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (err) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decodeToken?._id)

  if(!user){
    throw new ApiError(400 , "Invalid Refresh Token ")
  }

  if(incomingRefreshToken !== user?.refreshToken){
    throw new ApiError(401 , "Refresh Token is Expired or Used ")
  }
  

  const {accessToken , newRefreshToken} = await generateAccessTokenAndRefreshToken(user._id)

  await User.findByIdAndUpdate(user._id, { refreshToken: newRefreshToken });

  const options = {
    httpOnly: true,
    secure: true
  }

  return res 
  .status(200)
  .cookie("accessToken" ,accessToken , options )
  .cookie("refreshToken" ,newRefreshToken , options )
  .json(
    new ApiResponse(
      200 ,
      {accessToken , refreshToken: newRefreshToken},
        "Access Token generated successfully"
    )
  )

})



export {
    registerUser,
    loginUser,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    refreshAccessToken,
    changeProfileImage,
    assignRole
}