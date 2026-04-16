import { AppError } from "../utils/error.utils.js";
import PermissionModel from "../models/permission.model.js";
import { asyncWrapper } from "../utils/trycatch.js";

const authorizePermission = (requiredPermission) => {
  return asyncWrapper(async (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized("User is not authorized"));
    }

    // Super-user bypass: Owners have full access without DB checks
    if (req.user.role === "owner") {
      return next();
    }

    if (req.user.role === "admin") {
      const hasPermission = await PermissionModel.checkSpecificPermission(
        req.user.id,
        requiredPermission,
      );

      if (hasPermission) {
        return next();
      }
    }

    return next(
      AppError.forbidden(
        `Forbidden: Missing '${requiredPermission}' permission`,
      ),
    );
  });
};

export default authorizePermission;
