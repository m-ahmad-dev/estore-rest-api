import env from "../configs/env.js";
import { AppError } from "../utils/error.utils.js";
import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return next(AppError.unauthorized("No access token provided"));
  }

  try {
    const decoded = jwt.verify(token, env.ACCESS_SECRET);

    // Attach user payload to request object
    req.user = decoded;

    next();
  } catch (error) {
    // Handle specific JWT expiration error
    if (error.name === "TokenExpiredError") {
      return next(
        AppError.unauthorized("Access token expired", {
          errorCode: "ACCESS_TOKEN_EXPIRED",
        }),
      );
    }

    // Handle malformed or tampered tokens
    if (error.name === "JsonWebTokenError") {
      return next(AppError.invalidToken());
    }

    next(error);
  }
};

export default auth;
