import prisma from "../../core/configs/db.js";

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
      include: {
        _count: { select: { orders: true } },
      },
    });
  },

  findByPhone: async (phone, db = prisma) => {
    return await db.customers.findUnique({
      where: { phone: phone },
    });
  },

  isActive: async (id, db = prisma) => {
    
    const customer = await db.customers.findUnique({
      where: { id },
      select: { is_active: true },
    });

    return customer ? customer.is_active : null;
  },

  updatePassword: async (customerId, passwordHash, db = prisma) => {
    const customer = await db.customers.update({
      where: {
        id: customerId,
      },
      data: {
        password_hash: passwordHash,
      },
    });
  },

  updateProfile: async (customerId, data, db = prisma) => {
    const customer = await db.customers.update({
      where: { id: customerId },
      data,
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

    return customer ?? null;
  },

  deleteById: async (customerId, db = prisma) => {
    await db.customers.delete({
      where: {
        id: customerId,
      },
    });
  },

  // Get all customers with pagination.
  getAll: async (skip, limit, db = prisma) => {
    const customers = await db.customers.findMany({
      skip: skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!customers || customers.length === 0) return null;

    return customers;
  },

  totalCount: async (db = prisma) => {
    const count = await db.customers.count();
    return count;
  },

  updateStatus: async (id, status, db = prisma) => {
    const updated = await db.customers.update({
      where: { id: id },
      data: { is_active: status },
    });
    return !!updated;
  },
};

export default CustomerModel;
