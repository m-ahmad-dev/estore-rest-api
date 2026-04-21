import express from "express";
import authorizeRoles from "../middlewares/rbac.middleware.js";
import auth from "../middlewares/auth.middleware.js";
import validate from "../middlewares/input_validate.middleware.js";
import {
  createAdminSchema,
  loginSchema,
  permissionSchema,
  singlePermissionSchema,
} from "../validations/admin_route.validations.js";
import {
  isAdminActive,
  isExistAdmin,
} from "../middlewares/check.middleware.js";
import {
  createNewAdmin,
  deleteAdmin,
  getAdminById,
  getAllAdmins,
  updateAdminStatus,
} from "../controllers/admin.controller.js";
import {
  assignPermission,
  deleteAdminPermission,
  getAdminPermissions,
  putAdminPermissions,
} from "../controllers/permissions.controller.js";
import validateUUID from "../middlewares/valid_uuid.middleware.js";
import authorizePermission from "../middlewares/pbac.middleware.js";

const adminRoutes = express.Router();

// --- AUTH REQUIRED ---
adminRoutes.use(auth);
// --- ACTIVE CHECK (after auth) ---
adminRoutes.use(isAdminActive);

adminRoutes.post(
  "/admins",
  authorizePermission("admins.create"),
  validate(createAdminSchema),
  createNewAdmin,
);
adminRoutes.get("/admins", authorizePermission("admins.view"), getAllAdmins);
adminRoutes.get(
  "/admins/:id",
  validateUUID,
  authorizePermission("admins.view"),
  isExistAdmin,
  getAdminById,
);
adminRoutes.patch(
  "/admins/:id/status",
  validateUUID,
  authorizePermission("admins.deactivate"),
  isExistAdmin,
  updateAdminStatus,
);
adminRoutes.delete(
  "/admins/:id",
  validateUUID,
  authorizePermission("admins.delete"),
  isExistAdmin,
  deleteAdmin,
);
adminRoutes.get(
  "/admins/:id/permissions",
  validateUUID,
  authorizePermission("admins.edit"),
  isExistAdmin,
  getAdminPermissions,
);
adminRoutes.put(
  "/admins/:id/permissions",
  validateUUID,
  authorizePermission("admins.edit"),
  validate(permissionSchema),
  isExistAdmin,
  putAdminPermissions,
);
adminRoutes.post(
  "/admins/:id/permissions",
  validateUUID,
  authorizePermission("admins.edit"),
  validate(singlePermissionSchema),
  isExistAdmin,
  assignPermission,
);
adminRoutes.delete(
  "/admins/:id/permissions/:permission",
  validateUUID,
  authorizePermission("admins.edit"),
  isExistAdmin,
  deleteAdminPermission,
);

export default adminRoutes;
