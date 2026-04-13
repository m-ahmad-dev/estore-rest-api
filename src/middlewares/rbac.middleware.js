import { sendError } from "../utils/error.utils.js";

// Middleware to restrict access based on user roles.

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(sendError("Not Authenticated", 401));
    }

    // "Owner" has absolute access to all resources
    if (req.user.role === "owner") {
      return next();
    }

    // Check if the user's role is explicitly permitted for this route
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        sendError(
          `Role (${req.user.role}) is not allowed to access this resource`,
          403,
        ),
      );
    }

    next();
  };
};

export default authorizeRoles;
