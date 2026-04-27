import AdminModel from "./admin.model.js";
import AppError from "../../core/utils/error.utils.js";
import { toHash } from "../../core/utils/bcrypt.utils.js";
import { checkExistPermission } from "../../core/utils/permissions.utils.js";
import executeTransaction from "../../core/utils/dbTransaction.js";
import {
  adminPermissions,
  insertPermissions,
  permissionsId,
} from "../permissions/permissions.service.js";
import prisma from "../../core/configs/db.js";

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

  // Atomic operation: Create admin and assign initial permissions
  return await executeTransaction(async (client) => {
    const existing = await findAdminByEmail(email, client);

    if (existing) throw AppError.conflict("Email already exits");

    const passwordHash = await toHash(password);
    const admin = await AdminModel.insertAdmin(
      name,
      email,
      passwordHash,
      phone ?? null,
      createdBy,
      client,
    );

    if (permissions.length > 0) {
      const dbPermissions = await permissionsId(permissions, client);

      const existingNames = dbPermissions.map((p) => p.name);
      const missing = checkExistPermission(permissions, existingNames);

      if (missing !== true) {
        throw AppError.badRequest(`${missing.join(", ")} do not exist`);
      }

      await insertPermissions(
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
    const admin = await findAdminById(id, client);

    if (!admin) throw AppError.notFound("Admin");

    const permissions = await adminPermissions(id, client);

    delete admin.password_hash;

    return { ...admin, permissions };
  });
};

export const updateAdminStatusService = async (id, status) => {
  if (!status || (status !== "active" && status !== "deactive")) {
    throw AppError.badRequest(
      "Invalid status value",
      'Status must be either "active" or "deactive"',
    );
  }

  const isActive = status === "active" ? true : false;
  const updated = await AdminModel.updateStatus(id, isActive);

  if (!updated)
    throw AppError.internal("Something went worng. Failed to update status");

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

// Shared services
export const checkAdminStatus = async (id) => {
  return await AdminModel.isActive(id);
};

export const checkAdminExist = async (id) => {
  const admin = await AdminModel.findById(id);

  if (!admin) return null;
  return true;
};

export const findAdminByEmail = async (email, client = prisma) => {
  const admin = await AdminModel.findByEmail(email, client);
  return admin;
};

export const findAdminById = async (id, client = prisma) => {
  const admin = await AdminModel.findById(id, client);
  return admin;
};
