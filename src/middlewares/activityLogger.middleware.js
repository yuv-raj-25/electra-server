// middlewares/activityLogger.middleware.js
import { AdminActivity } from "../models/adminActivity.model.js";

export const logActivity = (action, targetModel) => {
  return async (req, res, next) => {
    // Store original data before update
    if (action === 'update' && req.params.id) {
      const Model = mongoose.model(targetModel);
      req.originalData = await Model.findById(req.params.id);
    }
    
    // Override res.json to log after successful response
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Only log on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        AdminActivity.create({
          adminId: req.user._id,
          action,
          targetModel,
          targetId: req.params.id || data?.data?._id,
          targetName: data?.data?.stationName || data?.data?.email,
          changes: {
            before: req.originalData?.toObject(),
            after: req.body
          },
          reason: req.body.reason || req.body.updateReason,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }).catch(err => console.error('Failed to log activity:', err));
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

// Usage in routes:
router.put('/stations/:id', 
  authenticate, 
  isAdmin, 
  logActivity('update', 'Station'), 
  updateStation
);