import prisma from '../../core/configs/db.js';

const COUPON_SELECT_FIELDS = {
  id: true,
  code: true,
  type: true,
  value: true,
  min_order_value: true,
  max_discount: true,
  max_uses: true,
  used_count: true,
  is_active: true,
  starts_at: true,
  expires_at: true,
  created_at: true,
  updated_at: true,
};

const CouponsModel = {
  create: async (data, db = prisma) => {
    return await db.coupons.create({
      data,
      select: COUPON_SELECT_FIELDS,
    });
  },

  findByCode: async (code, db = prisma) => {
    return await db.coupons.findUnique({
      where: { code },
      select: COUPON_SELECT_FIELDS,
    });
  },

  findValidByCode: async (code, db = prisma) => {
    const now = new Date();
    return await db.coupons.findFirst({
      where: {
        code,
        is_active: true,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
        starts_at: {
          lte: now,
        },
      },
    });
  },

  findById: async (id, db = prisma) => {
    return await db.coupons.findUnique({
      where: { id },
      select: COUPON_SELECT_FIELDS,
    });
  },

  update: async (id, data, db = prisma) => {
    return await db.coupons.update({
      where: { id },
      data,
      select: COUPON_SELECT_FIELDS,
    });
  },

  findAll: async (options = {}, db = prisma) => {
    return await db.coupons.findMany({
      ...options,
      select: COUPON_SELECT_FIELDS,
    });
  },
};

export default CouponsModel;
