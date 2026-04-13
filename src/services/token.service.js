import jwt from "jsonwebtoken";
import TokenModel from "../models/token.model.js";
import { sendError } from "../utils/error.utils.js";
import { generateAccessToken } from "../utils/jwtoken.utils.js";
import env from "../configs/env.js";
import executeTransaction from "../utils/dbTransaction.js";

/**
 * Validate the provided refresh token from the cookie and produce a
 * new access token if the refresh token is valid and not expired.
 */
const refreshTokenService = async (refreshToken) => {
  if (!refreshToken) {
    throw sendError("No refresh token provided", 401);
  }

  try {
    // 1. Check DB first
    const storedToken = await TokenModel.findByToken(refreshToken);
    if (!storedToken) {
      throw sendError("Invalid session. Please login.", 403);
    }

    // 2. DB Expiry Check
    if (storedToken.expiresAt && storedToken.expiresAt < new Date()) {
      // cleanup expired token
      await executeTransaction(async (client) => {
        await TokenModel.deleteByToken(refreshToken, client);
      });

      throw sendError(
        "Session Expired. Please login.",
        403,
        null,
        "REFRESH_TOKEN_EXPIRED",
      );
    }

    // 3. Verify token
    const decoded = jwt.verify(refreshToken, env.REFRESH_SECRET);

    // 4. Generate new access token
    const newAccessToken = generateAccessToken({
      id: decoded.id,
      role: decoded.role,
    });

    return {
      accessToken: newAccessToken,
      user: { id: decoded.id, role: decoded.role },
    };
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      const decodedPayload = jwt.decode(refreshToken);

      await executeTransaction(async (client) => {
        if (decodedPayload?.id) {
          await TokenModel.deleteByUserId(decodedPayload.id, client);
        }
      });

      throw sendError(
        "Session Expired. Please login.",
        403,
        null,
        "REFRESH_TOKEN_EXPIRED",
      );
    }

    if (error.name === "JsonWebTokenError") {
      throw sendError("Unauthorized: Invalid refresh token", 401);
    }

    throw error;
  }
};

export default refreshTokenService;
