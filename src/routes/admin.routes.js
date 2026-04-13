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

const adminRoutes = express.Router();

// --- AUTH REQUIRED ---
adminRoutes.use(auth);
// --- ACTIVE CHECK (after auth) ---
adminRoutes.use(isAdminActive);

// --- OWNER ONLY ---
adminRoutes.use(authorizeRoles("owner"));

adminRoutes.post("/admins", validate(createAdminSchema), createNewAdmin);
adminRoutes.get("/admins", getAllAdmins);
adminRoutes.get("/admins/:id", validateUUID, isExistAdmin, getAdminById);
adminRoutes.patch(
  "/admins/:id/status",
  validateUUID,
  isExistAdmin,
  updateAdminStatus,
);
adminRoutes.delete("/admins/:id", validateUUID, isExistAdmin, deleteAdmin);
adminRoutes.get(
  "/admins/:id/permissions",
  validateUUID,
  isExistAdmin,
  getAdminPermissions,
);
adminRoutes.put(
  "/admins/:id/permissions",
  validateUUID,
  validate(permissionSchema),
  isExistAdmin,
  putAdminPermissions,
);
adminRoutes.post(
  "/admins/:id/permissions",
  validateUUID,
  validate(singlePermissionSchema),
  isExistAdmin,
  assignPermission,
);
adminRoutes.delete(
  "/admins/:id/permissions/:permission",
  validateUUID,
  isExistAdmin,
  deleteAdminPermission,
);

export default adminRoutes;
