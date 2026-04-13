import express from "express";
import {
  isAdminActive,
  isCustomerActive,
} from "../middlewares/check.middleware.js";
import auth from "../middlewares/auth.middleware.js";
import { loginLimiter } from "../middlewares/rateLimiter.js";
import { loginSchema } from "../validations/admin_route.validations.js";
import validate from "../middlewares/input_validate.middleware.js";
import {
  loginAdmin,
  loginCustomer,
  logoutAdmin,
  logoutCustomer,
} from "../controllers/auth.controller.js";
import authorizeRoles from "../middlewares/rbac.middleware.js";
import { registerSchema } from "../validations/customers.validations.js";
import { registerCustomer } from "../controllers/customer.controller.js";

const authRoutes = express.Router();
// --- PUBLIC ROUTES ---
authRoutes.post(
  "/admin/login",
  loginLimiter,
  validate(loginSchema),
  loginAdmin,
);
authRoutes.post("/login", validate(loginSchema), loginCustomer);
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
