import jwt from "jsonwebtoken";
import TokenModel from "../models/token.model.js";
import { AppError } from "../utils/error.utils.js";
import { generateAccessToken } from "../utils/jwtoken.utils.js";
import env from "../configs/env.js";
import executeTransaction from "../utils/dbTransaction.js";

// Validate refresh token and generate new access token

const refreshTokenService = async (refreshToken) => {
  if (!refreshToken) {
    throw AppError.unauthorized("No refresh token provided");
  }

  try {
    // 1. Check DB first
    const storedToken = await TokenModel.findByToken(refreshToken);

    if (!storedToken) {
      throw AppError.forbidden("Invalid session. Please login.");
    }

    // 2. DB Expiry Check
    if (storedToken.expiresAt && storedToken.expiresAt < new Date()) {
      await executeTransaction(async (client) => {
        await TokenModel.deleteByToken(refreshToken, client);
      });

      throw new AppError("Session expired. Please login.", 403, {
        errorCode: "REFRESH_TOKEN_EXPIRED",
      });
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
    // JWT expired
    if (error.name === "TokenExpiredError") {
      const decodedPayload = jwt.decode(refreshToken);

      await executeTransaction(async (client) => {
        if (decodedPayload?.id) {
          await TokenModel.deleteByUserId(decodedPayload.id, client);
        }
      });

      throw new AppError("Session expired. Please login.", 403, {
        errorCode: "REFRESH_TOKEN_EXPIRED",
      });
    }

    // Invalid JWT
    if (error.name === "JsonWebTokenError") {
      throw AppError.invalidToken();
    }

    throw error;
  }
};

export default refreshTokenService;
