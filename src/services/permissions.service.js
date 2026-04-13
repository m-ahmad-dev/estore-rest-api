import PermissionModel from "../models/permission.model.js";
import executeTransaction from "../utils/dbTransaction.js";
import { sendError } from "../utils/error.utils.js";
import { checkExistPermission } from "../utils/permissions.utils.js";

// PERMISSION MANAGEMENT SERVICES

export const getAdminPermissionsService = async (id) => {
  return await PermissionModel.findPermissions(id);
};

export const replaceAdminPermissionsService = async (
  id,
  permissions,
  grantedBy,
) => {
  
  if (!id || !Array.isArray(permissions))
    throw sendError("Invalid input.", 400);

  return await executeTransaction(async (client) => {
    // Clean slate: Remove old and apply new permissions
    await PermissionModel.deleteAllPermissions(id, client);

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
        id,
        dbPermissions.map((p) => p.id),
        grantedBy,
        client,
      );
    }
    return await PermissionModel.findPermissions(id, client);
  });
};

export const assignPermissionService = (id, permissionName, grantedBy) => {
  return executeTransaction(async (client) => {
    const perm = await PermissionModel.findPermissionByName(
      permissionName,
      client,
    );
    if (!perm) throw sendError("Permission not found.", 404);

    const alreadyAssigned = await PermissionModel.checkSpecificPermission(
      id,
      perm.id,
      client,
    );
    if (alreadyAssigned) throw sendError("Permission already assigned.", 409);

    await PermissionModel.insertOnePermission(id, perm.id, grantedBy, client);
    return await PermissionModel.findPermissions(id, client);
  });
};

export const deleteAdminPermissionService = (id, permissionName) => {
  return executeTransaction(async (client) => {
    const perm = await PermissionModel.findPermissionByName(
      permissionName,
      client,
    );
    if (!perm) throw sendError("Permission not found.", 404);

    const isAssigned = await PermissionModel.checkSpecificPermission(
      id,
      perm.id,
      client,
    );
    if (!isAssigned)
      throw sendError("Permission not assigned to this admin.", 404);

    return await PermissionModel.deleteSpecificPermission(id, perm.id, client);
  });
};
