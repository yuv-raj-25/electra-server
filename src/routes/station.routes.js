import {Router} from "express";
import { verifyJWT }  from "../middlewares/auth.middleware.js";
import  {authorizeRoles } from "../middlewares/authorizeRoles.middleware.js";


import { 
    updateStation ,
    createStation,
    deleteStation,
    getAllStations,
    getStationById
} from "../controllers/station.controllers.js";


const router = Router();



// Public routes

router.route("/").get(getAllStations)
router.route("/:stationId").get(getStationById)


// Protected routes - only for admin users

router.route("/create-station").post(verifyJWT , authorizeRoles("admin") , createStation)
router.route("/delete-station").delete(verifyJWT , authorizeRoles("admin") , deleteStation)
router.route("/:stationId").put(verifyJWT , authorizeRoles("admin") , updateStation)




export default router;