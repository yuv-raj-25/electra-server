import { Router} from "express";
import { upload } from "../middlewares/multer.middleware.js";   
import { verifyJWT } from "../middlewares/auth.middleware.js"; 
import { authorizeRoles } from  "../middlewares/authorizeRoles.middleware.js";

import { 
    registerUser,
    loginUser,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    refreshAccessToken,
    changeProfileImage,
    assignRole
} 
from "../controllers/user.controllers.js";



const router = Router();

// router.get('/', (req, res) => {
//   res.send('User route is working!');
// });

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


// Only admin or superadmin can assign roles
router.patch("/assign-role", verifyJWT, authorizeRoles("admin"), assignRole);




export default router;