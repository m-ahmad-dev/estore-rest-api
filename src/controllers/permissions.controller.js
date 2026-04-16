import {
  assignPermissionService,
  deleteAdminPermissionService,
  getAdminPermissionsService,
  replaceAdminPermissionsService,
} from "../services/permissions.service.js";
import { asyncWrapper } from "../utils/trycatch.js";

// PERMISSION CONTROLLERS

export const getAdminPermissions = asyncWrapper(async (req, res) => {
  const permissions = await getAdminPermissionsService(req.params.id);
  return res.status(200).json({ success: true, permissions });
});

export const putAdminPermissions = asyncWrapper(async (req, res) => {
  const updated = await replaceAdminPermissionsService(
    req.params.id,
    req.body.permissions,
    req.user.id,
  );
  return res.status(200).json({
    success: true,
    message: "Permissions synced.",
    permissions: updated,
  });
});

export const assignPermission = asyncWrapper(async (req, res) => {
  const permission = req.body.permissions[0];
  const permissions = await assignPermissionService(
    req.params.id,
    permission,
    req.user?.id,
  );

  return res
    .status(201)
    .json({ success: true, message: "Permission assigned.", permissions });
});

export const deleteAdminPermission = asyncWrapper(async (req, res) => {
  const { id, permission } = req.params;
  await deleteAdminPermissionService(id, permission);
  return res
    .status(200)
    .json({ success: true, message: "Permission removed." });
});
