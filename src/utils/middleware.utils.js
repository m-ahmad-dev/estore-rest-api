import { AppError } from "./error.utils.js";
import { asyncWrapper } from "./trycatch.js";

// Helper fn() to check active both types of user.
export const isActive = (getUserFn) => {
  return asyncWrapper(async (req, res, next) => {
    const id = req.user?.id;

    if (!id) {
      return next(AppError.unauthorized("User session is invalid"));
    }

    const user = await getUserFn(id);

    if (user === null || user === undefined) {
      return next(AppError.notFound("User"));
    }

    const isActive = typeof user === "object" ? user.is_active : user;

    if (isActive === true) {
      return next();
    }

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

    if (!user) {
      return next(AppError.notFound("User"));
    }

    req.targetUser = user;
    return next();
  });
};
