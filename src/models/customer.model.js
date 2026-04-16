import prisma from "../configs/db.js";

const CustomerModel = {
  create: async (
    firstname,
    lastname,
    email,
    passwordHash = null,
    phoneNumber = null,
    db = prisma,
  ) => {
    return await db.customers.create({
      data: {
        first_name: firstname,
        last_name: lastname,
        email: email,
        phone: phoneNumber,
        password_hash: passwordHash,
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        is_active: true,
        created_at: true,
      },
    });
  },

  findByEmail: async (email, db = prisma) => {
    return await db.customers.findUnique({
      where: { email: email },
    });
  },

  findById: async (id, db = prisma) => {
    return await db.customers.findUnique({
      where: { id: id },
    });
  },

  isActive: async (id, db = prisma) => {
    const admin = await db.customers.findUnique({
      where: { id: id },
      select: { is_active: true },
    });
    return admin?.is_active ?? null;
  },
};

export default CustomerModel;
