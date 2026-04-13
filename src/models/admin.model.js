import prisma from "../configs/db.js";

const AdminModel = {
  insertAdmin: async (
    name,
    email,
    passwordHash,
    phone,
    createdBy,
    db = prisma,
  ) => {
    return await db.admins.create({
      data: {
        name: name,
        email: email,
        password_hash: passwordHash,
        phone_number: phone,
        created_by: createdBy,
      },
    });
  },

  findAll: async (db = prisma) => {
    const admins = await db.admins.findMany({
      include: {
        _count: {
          select: { permissions: true },
        },
      },
    });

    return admins;
  },

  findByEmail: async (email, db = prisma) => {
    return await db.admins.findUnique({
      where: { email: email },
    });
  },

  findById: async (id, db = prisma) => {
    const admin = await db.admins.findUnique({
      where: { id: id },
      include: {
        _count: {
          select: { permissions: true },
        },
      },
    });

    if (!admin) return null;
    return {
      ...admin,
      permission_count: admin._count.admin_permissions,
    };
  },

  updateStatus: async (status, id, db = prisma) => {
    const updated = await db.admins.update({
      where: { id: id },
      data: { is_active: status },
    });
    return !!updated;
  },

  deleteById: async (id, db = prisma) => {
    const deleted = await db.admins.delete({
      where: { id: id },
    });
    return !!deleted;
  },

  isActive: async (id, db = prisma) => {
    const admin = await db.admins.findUnique({
      where: { id: id },
      select: { is_active: true },
    });
    return admin?.is_active ?? null;
  },
};

export default AdminModel;
