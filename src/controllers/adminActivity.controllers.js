// // controllers/adminActivity.controller.js
// import { asyncHandler } from "../utility/asyncHandler.js";
// import { ApiError } from "../utility/ApiError.js";
// import { ApiResponse } from "../utility/ApiResponse.js";
// import { AdminActivity } from "../models/adminActivity.model.js";

// // Get all admin activities with filters
// const getAdminActivities = asyncHandler(async (req, res) => {
//   const {
//     adminId,
//     action,
//     targetModel,
//     startDate,
//     endDate,
//     page = 1,
//     limit = 50
//   } = req.query;
  
//   const activities = await AdminActivity.getByAdmin(adminId, {
//     limit: parseInt(limit),
//     skip: (page - 1) * limit,
//     action,
//     targetModel,
//     startDate,
//     endDate
//   });
  
//   const total = await AdminActivity.countDocuments({
//     ...(adminId && { adminId }),
//     ...(action && { action }),
//     ...(targetModel && { targetModel })
//   });
  
//   return res.status(200).json(
//     new ApiResponse(200, {
//       activities,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit)
//       }
//     }, "Activities fetched successfully")
//   );
// });

// // Get activity statistics
// const getActivityStatistics = asyncHandler(async (req, res) => {
//   const { startDate, endDate } = req.query;
  
//   const stats = await AdminActivity.getStatistics(startDate, endDate);
  
//   return res.status(200).json(
//     new ApiResponse(200, stats, "Statistics fetched successfully")
//   );
// });

// // Get activity history for specific target
// const getTargetHistory = asyncHandler(async (req, res) => {
//   const { targetModel, targetId } = req.params;
  
//   const history = await AdminActivity.getByTarget(targetModel, targetId);
  
//   return res.status(200).json(
//     new ApiResponse(200, history, "Target history fetched successfully")
//   );
// });



// export {
//     getAdminActivities,
//     getActivityStatistics,
//     getTargetHistory
// }