import jwt from "jsonwebtoken";
import TokenModel from "./token.model.js";
import AppError from "../../core/utils/error.utils.js";
import { generateAccessToken } from "../../core/utils/jwtoken.utils.js";
import env from "../../core/configs/env.js";
import executeTransaction from "../../core/utils/dbTransaction.js";
import prisma from "../../core/configs/db.js";

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
        await deleteByToken(refreshToken, client);
      });

      throw new AppError("Session expired. Please login.", 403, {
        errorCode: "REFRESH_TOKEN_EXPIRED",
      });
    }

    const decoded = jwt.verify(refreshToken, env.REFRESH_SECRET); // Verify token
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
          await deleteByUserId(decodedPayload.id, client);
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

// Shared Services
export const createSession = async (
  userId,
  tokenHash,
  userType,
  client = prisma,
) => {
  return await TokenModel.insert(userId, tokenHash, userType, client);
};

export const deleteByToken = async (refreshToken, client = prisma) => {
  await TokenModel.deleteByToken(refreshToken, client);
};

export const deleteByUserId = async (userId, client = prisma) => {
  await TokenModel.deleteByUserId(userId, client);
};
