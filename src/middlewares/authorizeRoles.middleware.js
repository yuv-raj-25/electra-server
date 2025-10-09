// middlewares/authorizeRoles.js
import {ApiError} from "../utility/ApiError.js";
// No additional code needed at $PLACEHOLDER$

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, "You do not have permission to perform this action");
    }
    next();
  };
};
