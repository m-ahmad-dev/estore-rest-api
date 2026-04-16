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

    if (!user) {
      return next(AppError.notFound("User"));
    }

    // if model returns boolean for active status
    if (user === true) {
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
        AppError.validationError([
          { field: "id", message: "User id is required" },
        ]),
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
