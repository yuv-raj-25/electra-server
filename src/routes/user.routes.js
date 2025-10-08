import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";   
import { verifyJWT } from "../middlewares/verifyJWT.js"; 

import { 
    registerUser,
    loginUser,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    refreshAccessToken,
    changeProfileImage
} 
from "../controllers/user.controllers.js";



const router = Router();

router.route("/register").post(upload.fields([
    { name: 'profileImage', maxCount: 1 },
]), registerUser);

router.route("/login").post(loginUser)

// secure routes 
router.route("/logOut").post(verifyJWT , logoutUser)
router.route("/change-password").post(verifyJWT , changeCurrentPassword)
router.route("/current-user").get(verifyJWT , getCurrentUser)
router.route("/refresh-access-token").get(verifyJWT , refreshAccessToken)
router.route("/change-profile-image").post(verifyJWT , upload.single('profileImage') , changeProfileImage)




export default router;