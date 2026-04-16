import env from "../configs/env.js";
import {
  handleGoogleAuthService,
  loginAdminService,
  loginCustomerService,
  logoutAdminService,
  logoutCustomerService,
} from "../services/auth.service.js";

import { sendError } from "../utils/error.utils.js";
import { asyncWrapper } from "../utils/trycatch.js";

// ADMIN AUTHENTICATION CONTROLLERS

export const loginAdmin = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;
  const { admin, accessToken, refreshToken, permissions } =
    await loginAdminService(email, password);

  // Set secure cookies for token storage
  const cookieOptions = { httpOnly: true, secure: true, sameSite: "Strict" };

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    path: "/api/v1/refresh-token",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });

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

  const clearOptions = { httpOnly: true, secure: true, sameSite: "Strict" };
  res.clearCookie("accessToken", clearOptions);
  res.clearCookie("refreshToken", {
    ...clearOptions,
    path: "/api/v1/refresh-token",
  });

  return res.status(200).json({ success: true, message: "Logout successful." });
});

// CUSTOMER AUTHENTICATION CONTROLLERS

export const loginCustomer = asyncWrapper(async (req, res) => {
  const { customer, accessToken, refreshToken } = await loginCustomerService(
    req.body,
  );

  if (!customer || !accessToken || !refreshToken)
    throw sendError(
      "Internal server error.",
      500,
      "Login failed.",
      "SERVER_ERROR",
    );

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/api/v1/refresh-token",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });

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

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/api/v1/refresh-token",
  });

  return res.status(200).json({ success: true, message: "Logout successful." });
});

// Google OAuth CONTROLLERS

export const googleAuthCallback = asyncWrapper(async (req, res) => {
  try {
    const { accessToken, refreshToken } = await handleGoogleAuthService(
      req.user,
    );

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/api/v1/refresh-token",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

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
