import prisma from "../configs/db.js";

const PermissionModel = {
  // Bulk assign permissions to an admin; skipDuplicates prevents 409 errors
  insertPermissions: async (adminId, permissionIds, grantedBy, db = prisma) => {
    const data = permissionIds.map((pId) => ({
      admin_id: adminId,
      permission_id: pId,
      granted_by: grantedBy,
    }));

    return await db.admin_permissions.createMany({
      data,
      skipDuplicates: true,
    });
  },

  // Assign a single permission entry
  insertOnePermission: async (
    adminId,
    permissionId,
    grantedBy,
    db = prisma,
  ) => {
    return await db.admin_permissions.create({
      data: {
        admin_id: adminId,
        permission_id: permissionId,
        granted_by: grantedBy,
      },
    });
  },

  // Returns a flat array of permission names assigned to an admin
  findPermissions: async (adminId, db = prisma) => {
    const result = await db.admin_permissions.findMany({
      where: { admin_id: adminId },
      select: {
        permission: { select: { name: true } },
      },
    });
    return result.map((r) => r.permission.name);
  },

  // Clear all permissions for a specific admin (used in full resets)
  deleteAllPermissions: async (adminId, db = prisma) => {
    return await db.admin_permissions.deleteMany({
      where: { admin_id: adminId },
    });
  },

  // Locate permission record by unique name
  findPermissionByName: async (name, db = prisma) => {
    return await db.permissions.findUnique({
      where: { name },
    });
  },

  // Bulk lookup for permission IDs using the SQL 'IN' operator
  findPermissionIds: async (permissionNames = [], db = prisma) => {
    return await db.permissions.findMany({
      where: { name: { in: permissionNames } },
      select: { id: true, name: true },
    });
  },

  // Verifies if admin possesses a specific permission (handles both ID and Name)
  checkSpecificPermission: async (adminId, requiredPermission, db = prisma) => {
    const isId =
      typeof requiredPermission === "number" || !isNaN(requiredPermission);

    const permissionFilter = isId
      ? { id: Number(requiredPermission) }
      : { name: String(requiredPermission) };

    const count = await db.admin_permissions.count({
      where: {
        admin_id: adminId,
        permission: permissionFilter,
      },
    });
    return count > 0;
  },

  // Remove a single permission link and return success boolean
  deleteSpecificPermission: async (adminId, permId, db = prisma) => {
    const result = await db.admin_permissions.deleteMany({
      where: {
        admin_id: adminId,
        permission_id: permId,
      },
    });
    return result.count > 0;
  },
};

export default PermissionModel;
