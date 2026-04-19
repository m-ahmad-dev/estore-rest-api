import express from "express";
import {
  isAdminActive,
  isCustomerActive,
} from "../middlewares/check.middleware.js";
import auth from "../middlewares/auth.middleware.js";
import {
  forgotPasswordLimiter,
  loginLimiter,
  resetPasswordLimiter,
} from "../middlewares/rateLimiter.js";
import { loginSchema } from "../validations/admin_route.validations.js";
import validate from "../middlewares/input_validate.middleware.js";
import {
  forgotPassword,
  googleAuthCallback,
  loginAdmin,
  loginCustomer,
  logoutAdmin,
  logoutCustomer,
  resetPassword,
} from "../controllers/auth.controller.js";
import authorizeRoles from "../middlewares/rbac.middleware.js";
import {
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validations/customers.validations.js";
import { registerCustomer } from "../controllers/customer.controller.js";
import passport from "passport";

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
    failureRedirect: `${process.env.FRONTEND_URL}/auth/login?error=google_failed`,
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
