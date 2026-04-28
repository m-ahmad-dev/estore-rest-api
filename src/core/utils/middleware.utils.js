import AppError from "./error.utils.js";
import { asyncWrapper } from "./trycatch.js";

// Helper fn() to check active both types of user.
export const isActive = (getStatusFn) => {
  return asyncWrapper(async (req, res, next) => {
    const id = req.user?.id;

    if (!id) return next(AppError.unauthorized("User session is invalid"));

    const activeStatus = await getStatusFn(id);

    if (activeStatus === null) return next(AppError.notFound("User"));
    if (activeStatus === true) return next();

    return next(AppError.forbidden("Your account is disabled"));
  });
};

// Helper fn() to check existence both types of user.
export const isExist = (getUserFn) => {
  return asyncWrapper(async (req, res, next) => {
    const { id } = req.params;

    if (!id) {
      return next(
        AppError.badRequest(
          "User ID is required",
          "Missing required parameter: user UUID",
        ),
      );
    }

    const user = await getUserFn(id);
    if (!user) return next(AppError.notFound("User"));

    return next();
  });
};
