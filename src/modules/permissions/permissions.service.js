import prisma from "../../core/configs/db.js";
import PermissionModel from "./permissions.model.js";
import executeTransaction from "../../core/utils/dbTransaction.js";
import AppError from "../../core/utils/error.utils.js";
import { checkExistPermission } from "../../core/utils/permissions.utils.js";

// PERMISSION MANAGEMENT SERVICES

export const getAdminPermissionsService = async (id) => {
  if (!id) {
    return AppError.validationError([
      { field: "id", message: "Admin id is requried" },
    ]);
  }
  return await adminPermissions(id);
};

export const replaceAdminPermissionsService = async (
  id,
  permissions,
  grantedBy,
) => {
  const errors = [
    !id && { field: "id", message: "Admin id is required" },
    !Array.isArray(permissions) && {
      field: "permissions",
      message: "Permissions must be an array",
    },
  ].filter(Boolean);

  if (errors.length) throw AppError.validationError(errors);

  return await executeTransaction(async (client) => {
    // Clean slate: Remove old and apply new permissions
    await PermissionModel.deleteAllPermissions(id, client);

    if (permissions.length > 0) {
      const dbPermissions = await permissionsId(permissions, client);
      const existingNames = dbPermissions.map((p) => p.name);
      const missing = checkExistPermission(permissions, existingNames);

      if (missing !== true) {
        throw AppError.validationError(
          missing.map((name) => ({
            field: "permissions",
            message: `${name} does not exist`,
          })),
        );
      }

      await insertPermissions(
        id,
        dbPermissions.map((p) => p.id),
        grantedBy,
        client,
      );
    }

    return await adminPermissions(id, client);
  });
};

export const assignPermissionService = (id, permissionName, grantedBy) => {
  const errors = [
    !id && { field: "id", message: "Admin id is required" },
    !permissionName && {
      field: "permissionName",
      message: "Permission name is required",
    },
  ].filter(Boolean);

  if (errors.length) throw AppError.validationError(errors);

  return executeTransaction(async (client) => {
    const perm = await PermissionModel.findPermissionByName(
      permissionName,
      client,
    );

    if (!perm) throw AppError.notFound("Permission");

    const alreadyAssigned = await isPermissionAssign(id, perm.id, client);
    if (alreadyAssigned) throw AppError.conflict("Permission already assigned");

    await PermissionModel.insertOnePermission(id, perm.id, grantedBy, client);

    return await adminPermissions(id, client);
  });
};

export const deleteAdminPermissionService = (id, permissionName) => {
  const errors = [
    !id && { field: "id", message: "Admin id is required" },
    !permissionName && {
      field: "permissionName",
      message: "Permission name is required",
    },
  ].filter(Boolean);

  if (errors.length) throw AppError.validationError(errors);

  return executeTransaction(async (client) => {
    const perm = await PermissionModel.findPermissionByName(
      permissionName,
      client,
    );

    if (!perm) throw AppError.notFound("Permission");

    const isAssigned = await isPermissionAssign(id, perm.id, client);

    if (!isAssigned) {
      throw AppError.notFound("Permission not assigned to this admin");
    }

    return await PermissionModel.deleteSpecificPermission(id, perm.id, client);
  });
};

// Shared Services
export const permissionsId = async (permissions, client = prisma) => {
  const ids = await PermissionModel.findPermissionIds(permissions, client);
  return ids;
};

export const insertPermissions = async (
  adminId,
  dbPermissions,
  createdBy,
  client = prisma,
) => {
  await PermissionModel.insertPermissions(
    adminId,
    dbPermissions,
    createdBy,
    client,
  );
};

export const adminPermissions = async (id, client = prisma) => {
  const permissions = await PermissionModel.findPermissions(id, client);
  return permissions;
};

export const isPermissionAssign = async (
  id,
  requiredPermission,
  client = prisma,
) => {
  const permission = await PermissionModel.checkSpecificPermission(
    id,
    requiredPermission,
    client,
  );
  return permission;
};
