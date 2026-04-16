import AdminModel from "../models/admin.model.js";
import { AppError } from "../utils/error.utils.js";
import { toHash } from "../utils/bcrypt.utils.js";
import { checkExistPermission } from "../utils/permissions.utils.js";
import PermissionModel from "../models/permission.model.js";
import executeTransaction from "../utils/dbTransaction.js";

// ADMIN MANAGEMENT SERVICES

export const createAdminService = async (
  name,
  email,
  password,
  phone,
  permissions = [],
  createdBy,
) => {
  const errors = [
    !name && { field: "name", message: "Name is required" },
    !email && { field: "email", message: "Email is required" },
    !password && { field: "password", message: "Password is required" },
    !Array.isArray(permissions) && {
      field: "permissions",
      message: "Permissions must be an array",
    },
  ].filter(Boolean);

  if (errors.length) throw AppError.validationError(errors);

  const existing = await AdminModel.findByEmail(email);

  if (existing) {
    throw AppError.conflict("Email already exits");
  }

  const passwordHash = await toHash(password);

  // Atomic operation: Create admin and assign initial permissions
  return await executeTransaction(async (client) => {
    const admin = await AdminModel.insertAdmin(
      name,
      email,
      passwordHash,
      phone ?? null,
      createdBy,
      client,
    );

    if (permissions.length > 0) {
      const dbPermissions = await PermissionModel.findPermissionIds(
        permissions,
        client,
      );

      const existingNames = dbPermissions.map((p) => p.name);
      const missing = checkExistPermission(permissions, existingNames);

      if (missing !== true) {
        throw AppError.badRequest(`${missing.join(", ")} do not exist`);
      }

      await PermissionModel.insertPermissions(
        admin.id,
        dbPermissions.map((p) => p.id),
        createdBy,
        client,
      );
    }

    delete admin.password_hash;
    return admin;
  });
};

export const getAllAdminsService = async () => {
  const admins = await AdminModel.findAll();

  return admins.map((admin) => {
    delete admin.password_hash;
    return {
      ...admin,
      permission_count: admin._count.admin_permissions,
    };
  });
};

export const getAdminByIdService = (id) => {
  return executeTransaction(async (client) => {
    const admin = await AdminModel.findById(id, client);

    if (!admin) throw AppError.notFound("Admin");

    const permissions = await PermissionModel.findPermissions(id, client);

    delete admin.password_hash;

    return { ...admin, permissions };
  });
};

export const updateAdminStatusService = async (id, status) => {
  const errors = [
    !id && { field: "id", message: "Admin id is required" },
    typeof status !== "boolean" && {
      field: "status",
      message: "Status must be boolean",
    },
  ].filter(Boolean);

  if (errors.length) throw AppError.validationError(errors);

  const updated = await AdminModel.updateStatus(status, id);

  if (!updated) {
    throw AppError.internal("Failed to update admin status");
  }

  return updated;
};

export const deleteAdminService = async (id) => {
  if (!id) {
    throw AppError.validationError([
      { field: "id", message: "Admin id is required" },
    ]);
  }

  const deleted = await AdminModel.deleteById(id);

  if (!deleted) {
    throw AppError.internal("Failed to delete admin");
  }

  return deleted;
};
