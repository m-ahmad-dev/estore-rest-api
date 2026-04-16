import TokenModel from "../models/token.model.js";
import { compareHash, toHash } from "./bcrypt.utils.js";
import executeTransaction from "./dbTransaction.js";
import { AppError } from "./error.utils.js";
import { generateAccessToken, generateRefreshToken } from "./jwtoken.utils.js";
import { tryCatch } from "./trycatch.js";

// Login utilty that handles both admin and customers.
export const loginService = tryCatch(
  async ({
    email,
    password,
    findUserByEmail,
    buildPayload,
    buildResponse,
    role,
  }) => {
    const errors = [
      !email && { field: "email", message: "Email is required" },
      !password && { field: "password", message: "Password is required" },
    ].filter(Boolean);

    if (errors.length) throw AppError.validationError(errors);

    return await executeTransaction(async (client) => {
      // Check user existence and status
      const user = await findUserByEmail(email, client);

      if (!user) {
        throw AppError.unauthorized("Invalid email or password");
      }

      if (!user.is_active) {
        throw AppError.forbidden("Your account is disabled");
      }

      // Verify password
      const isValid = await compareHash(password, user.password_hash);

      if (!isValid) {
        throw AppError.unauthorized("Invalid email or password");
      }

      // Generate session tokens
      const payload = buildPayload(user);
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Securely store hashed refresh token in DB
      const refreshTokenHash = await toHash(refreshToken);
      await TokenModel.insert(user.id, refreshTokenHash, role, client);

      const extraData = await buildResponse(user, client);

      return { ...extraData, accessToken, refreshToken };
    });
  },
);

// Logout utilty that handles both admin and customers.
export const logoutService = tryCatch(
  async ({ refreshToken, userId, findUserById }) => {
    if (!userId) {
      throw AppError.validationError([
        { field: "userId", message: "UserId is required" },
      ]);
    }

    await executeTransaction(async (client) => {
      const user = await findUserById(userId, client);

      if (!user) {
        throw AppError.notFound("User");
      }

      if (!user.is_active) {
        throw AppError.forbidden("Your account is disabled");
      }

      // Revoke specific session or all device sessions
      if (refreshToken) {
        await TokenModel.deleteByToken(refreshToken, client);
      } else {
        await TokenModel.deleteByUserId(userId, client);
      }
    });

    return { success: true };
  },
);
