import env from "../configs/env.js";
import { sendError } from "../utils/error.utils.js";
import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return next(sendError("Unauthorized: No token provided", 401));
  }

  try {
    const decoded = jwt.verify(token, env.ACCESS_SECRET);
    // Attach user payload to request object
    req.user = decoded;
    next();
  } catch (error) {
    // Handle specific JWT expiration error
    if (error.name === "TokenExpiredError") {
      return next(sendError("Unauthorized: Access token expired", 401));
    }

    // Handle malformed or tampered tokens
    if (error.name === "JsonWebTokenError") {
      return next(sendError("Unauthorized: Invalid access token", 401));
    }

    next(error);
  }
};

export default auth;
