import express from "express";
import authorizeRoles from "../../core/middlewares/rbac.middleware.js";
import auth from "../../core/middlewares/auth.middleware.js";
import validate from "../../core/middlewares/input_validate.middleware.js";
import {
  createAdminSchema,
  loginSchema,
  permissionSchema,
  singlePermissionSchema,
} from "./admin.validations.js";
import {
  isAdminActive,
  isExistAdmin,
} from "../../core/middlewares/check.middleware.js";
import {
  createNewAdmin,
  deleteAdmin,
  getAdminById,
  getAllAdmins,
  updateAdminStatus,
} from "./admin.controller.js";
import {
  assignPermission,
  deleteAdminPermission,
  getAdminPermissions,
  putAdminPermissions,
} from "../permissions/permissions.controller.js";
import validateUUID from "../../core/middlewares/valid_uuid.middleware.js";
import authorizePermission from "../../core/middlewares/pbac.middleware.js";

const adminRoutes = express.Router();

// --- AUTH REQUIRED ---
adminRoutes.use(auth);
// --- ACTIVE CHECK (after auth) ---
adminRoutes.use(isAdminActive);

adminRoutes.post(
  "/",
  authorizePermission("admins.create"),
  validate(createAdminSchema),
  createNewAdmin,
);
adminRoutes.get("/", authorizePermission("admins.view"), getAllAdmins);
adminRoutes.get(
  "/:id",
  validateUUID,
  authorizePermission("admins.view"),
  isExistAdmin,
  getAdminById,
);
adminRoutes.patch(
  "/:id/status",
  validateUUID,
  authorizePermission("admins.deactivate"),
  isExistAdmin,
  updateAdminStatus,
);
adminRoutes.delete(
  "/:id",
  validateUUID,
  authorizePermission("admins.delete"),
  isExistAdmin,
  deleteAdmin,
);
adminRoutes.get(
  "/:id/permissions",
  validateUUID,
  authorizePermission("admins.edit"),
  isExistAdmin,
  getAdminPermissions,
);
adminRoutes.put(
  "/:id/permissions",
  validateUUID,
  authorizePermission("admins.edit"),
  validate(permissionSchema),
  isExistAdmin,
  putAdminPermissions,
);
adminRoutes.post(
  "/:id/permissions",
  validateUUID,
  authorizePermission("admins.edit"),
  validate(singlePermissionSchema),
  isExistAdmin,
  assignPermission,
);
adminRoutes.delete(
  "/:id/permissions/:permission",
  validateUUID,
  authorizePermission("admins.edit"),
  isExistAdmin,
  deleteAdminPermission,
);

export default adminRoutes;
