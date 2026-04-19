import env from "../configs/env.js";
import {
  forgotPasswordServices,
  handleGoogleAuthService,
  loginAdminService,
  loginCustomerService,
  logoutAdminService,
  logoutCustomerService,
  resetPasswordServices,
} from "../services/auth.service.js";
import {
  accessCookieConfig,
  clearAuthCookies,
  refreshCookieConfig,
} from "../utils/cookies.utils.js";
import { AppError } from "../utils/error.utils.js";
import { asyncWrapper } from "../utils/trycatch.js";

// ADMIN AUTHENTICATION CONTROLLERS

export const loginAdmin = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;
  const { admin, accessToken, refreshToken, permissions } =
    await loginAdminService(email, password);

  // Set secure cookies for token storage
  res.cookie("accessToken", accessToken, accessCookieConfig);
  res.cookie("refreshToken", refreshToken, refreshCookieConfig);

  return res.status(200).json({
    success: true,
    message: "Login successful.",
    admin: { ...admin, permissions },
    accessToken,
  });
});

export const logoutAdmin = asyncWrapper(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  const userId = req.user?.id;

  await logoutAdminService({ refreshToken, userId });

  clearAuthCookies(res);

  return res.status(200).json({ success: true, message: "Logout successful." });
});

// CUSTOMER AUTHENTICATION CONTROLLERS

export const loginCustomer = asyncWrapper(async (req, res, next) => {
  const { customer, accessToken, refreshToken } = await loginCustomerService(
    req.body,
  );

  if (!customer || !accessToken || !refreshToken)
    return next(AppError.internal("Login failed. Try again later"));

  res.cookie("accessToken", accessToken, accessCookieConfig);
  res.cookie("refreshToken", refreshToken, refreshCookieConfig);

  res.status(200).json({
    success: true,
    message: "Login successfully.",
    customer,
    accessToken,
  });
});

export const logoutCustomer = asyncWrapper(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  const userId = req.user?.id;

  await logoutCustomerService({ refreshToken, userId });

  clearAuthCookies(res);

  return res.status(200).json({ success: true, message: "Logout successful." });
});

export const forgotPassword = asyncWrapper(async (req, res) => {
  const result = await forgotPasswordServices(req.body);
  return res.status(200).json({
    success: true,
    message: "If an account with that email exists, we have sent a reset link.",
  });
});

export const resetPassword = asyncWrapper(async (req, res) => {
  const result = await resetPasswordServices(req.body);

  res.status(200).json({
    success: true,
    message: "Password reset successfully.",
  });
});

// Google OAuth CONTROLLERS

export const googleAuthCallback = asyncWrapper(async (req, res) => {
  try {
    const { accessToken, refreshToken } = await handleGoogleAuthService(
      req.user,
    );

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("accessToken", accessToken, accessCookieConfig);

    res.cookie("refreshToken", refreshToken, refreshCookieConfig);

    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?login=success`,
    );
  } catch (error) {
    console.error("OAuth Error Message:", error);
    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/login?error=oauth_failed`,
    );
  }
});
