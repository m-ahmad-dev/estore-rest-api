import prisma from "../../core/configs/db.js";

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
        name,
        email,
        password_hash: passwordHash,
        phone_number: phone,
        created_by: createdBy,
      },
    });
  },

  findAll: async (db = prisma) => {
    const admins = await db.admins.findMany({
      orderBy: {
        created_at: "asc",
      },
      include: {
        _count: {
          select: {
            permissions: true,
          },
        },
      },
    });

    return admins;
  },

  findByEmail: async (email, db = prisma) => {
    return await db.admins.findUnique({
      where: {
        email,
      },
    });
  },

  findById: async (id, db = prisma) => {
    const admin = await db.admins.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            permissions: true,
          },
        },
      },
    });

    if (!admin) {
      return null;
    }

    return {
      ...admin,
      permission_count: admin._count.permissions,
    };
  },

  updateStatus: async (id, status, db = prisma) => {
    const updated = await db.admins.update({
      where: {
        id,
      },
      data: {
        is_active: status,
      },
    });

    return !!updated;
  },

  deleteById: async (id, db = prisma) => {
    const deleted = await db.admins.delete({
      where: {
        id,
      },
    });

    return !!deleted;
  },

  isActive: async (id, db = prisma) => {
    const admin = await db.admins.findUnique({
      where: {
        id,
      },
      select: {
        is_active: true,
      },
    });

    return admin?.is_active ?? null;
  },
};

export default AdminModel;