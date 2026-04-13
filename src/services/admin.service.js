import AdminModel from "../models/admin.model.js";
import { sendError } from "../utils/error.utils.js";
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
  if (!name || !email || !password || !Array.isArray(permissions)) {
    throw sendError("Required fields are missing.", 400);
  }

  const existing = await AdminModel.findByEmail(email);
  if (existing) throw sendError("Email already in use.", 409);

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
      if (missing !== true)
        throw sendError(`${missing.join(", ")} do not exist`, 400);

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
    if (!admin) throw sendError("Admin not found.", 404);

    const permissions = await PermissionModel.findPermissions(id, client);
    delete admin.password_hash;
    return { ...admin, permissions };
  });
};

export const updateAdminStatusService = async (id, status) => {
  if (!id || typeof status !== "boolean")
    throw sendError("Invalid status data.", 400);

  const updated = await AdminModel.updateStatus(status, id);
  if (!updated) throw sendError("Failed to update status.", 500);
  return updated;
};

export const deleteAdminService = async (id) => {
  const deleted = await AdminModel.deleteById(id);
  if (!deleted) throw sendError("Failed to delete admin.", 500);
};
