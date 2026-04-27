import jwt from "jsonwebtoken";
import env from "../configs/env.js";
import { tryCatch } from "../utils/trycatch.js";

// Generates short-lived token (15m) for API requests
export const generateAccessToken = tryCatch((payload) => {
  return jwt.sign(payload, env.ACCESS_SECRET, {
    expiresIn: 900,
  });
});

// Generates long-lived token (14d) for session persistence
export const generateRefreshToken = tryCatch((payload) => {
  return jwt.sign(payload, env.REFRESH_SECRET, {
    expiresIn: "14d",
  });
});
