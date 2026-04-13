import { sendError } from "./error.utils.js";
import { asyncWrapper } from "./trycatch.js";

// Helper fn() to check active both types of user.
export const isActive = (getUserFn) => {
  return asyncWrapper(async (req, res, next) => {
    const id = req.user?.id;

    if (!id) return next(sendError("Unauthorized: invalid user session", 401));

    const user = await getUserFn(id);

    if (!user) return next(sendError("User not found", 404));

    if (user === true) return next();

    return next(sendError("Unauthorized: Your account disabled", 401));
  });
};

// Helper fn() to check existence both types of user.
export const isExist = (getUserFn) => {
  return asyncWrapper(async (req, res, next) => {
    const { id } = req.params;

    const admin = await getUserFn(id);
    if (!id) return next(sendError("Admin id is required.", 400));

    if (!admin) return next(sendError("Admin does not exist.", 404));

    req.targetAdmin = admin;
    return next();
  });
};
