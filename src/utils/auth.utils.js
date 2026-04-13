import TokenModel from "../models/token.model.js";
import { compareHash, toHash } from "./bcrypt.utils.js";
import executeTransaction from "./dbTransaction.js";
import { sendError } from "./error.utils.js";
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
    if (!email || !password)
      throw sendError("Email and password are required.", 400);

    return await executeTransaction(async (client) => {
      // Check user existence and status
      const user = await findUserByEmail(email, client);

      if (!user) throw sendError("Invalid email or password.", 401);
      if (!user.is_active) throw sendError("Your account is disabled.", 403);

      // Verify password
      const isValid = await compareHash(password, user.password_hash);
      if (!isValid) throw sendError("Invalid email or password.", 401);

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
    if (!userId) throw sendError("UserId is required.", 400);

    await executeTransaction(async (client) => {
      const user = await findUserById(userId, client);
      if (!user) throw sendError("User does not exist.", 404);
      if (!user.is_active) throw sendError("Your account is disabled.", 403);

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
