import { sendError } from "../utils/error.utils.js";
import PermissionModel from "../models/permission.model.js";
import { asyncWrapper } from "../utils/trycatch.js";

const authorizePermission = async (requiredPermission) => {
  return asyncWrapper(async (req, res, next) => {
    if (!req.user) return next(sendError("Unauthorized", 401));

    // Super-user bypass: Owners have full access without DB checks
    if (req.user.role === "owner") return next();

    if (req.user.role === "admin") {
      const hasPermission = await PermissionModel.checkSpecificPermission(
        req.user.id,
        requiredPermission,
      );

      if (hasPermission) return next();
    }

    return next(
      sendError(`Forbidden: Missing '${requiredPermission}' permission`, 403),
    );
  });
};

export default authorizePermission;
