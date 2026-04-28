import passport from "passport";
import express from "express";
import validate from "../../core/middlewares/input_validate.middleware.js";
import env from "../../core/configs/env.js";
import auth from "../../core/middlewares/auth.middleware.js";
import authorizeRoles from "../../core/middlewares/rbac.middleware.js";
import {
  isAdminActive,
  isCustomerActive,
} from "../../core/middlewares/check.middleware.js";
import {
  forgotPasswordLimiter,
  loginLimiter,
  resetPasswordLimiter,
} from "../../core/middlewares/rateLimiter.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../customer/customer.validations.js";
import {
  forgotPassword,
  googleAuthCallback,
  loginAdmin,
  loginCustomer,
  logoutAdmin,
  logoutCustomer,
  resetPassword,
} from "./auth.controller.js";
import { registerCustomer } from "../customer/customer.controller.js";

const authRoutes = express.Router();

// --- PUBLIC ROUTES ---
authRoutes.post(
  "/admin/login",
  loginLimiter,
  validate(loginSchema),
  loginAdmin,
);
authRoutes.post("/login", validate(loginSchema), loginCustomer);
authRoutes.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);
authRoutes.post(
  "/reset-password",
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);
// Customers OAuth routes.
authRoutes.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
authRoutes.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false, // Using JWTs, so we don't need sessions.
    failureRedirect: `${env.FRONTEND_URL}/auth/login?error=google_failed`,
  }),
  googleAuthCallback,
);
authRoutes.post("/register", validate(registerSchema), registerCustomer);

// --- AUTH REQUIRED ---
authRoutes.use(auth);

// --- LOGOUT ---
authRoutes.post(
  "/admin/logout",
  authorizeRoles("admin", "owner"),
  isAdminActive,
  logoutAdmin,
);
authRoutes.post("/logout", isCustomerActive, logoutCustomer);

export default authRoutes;
