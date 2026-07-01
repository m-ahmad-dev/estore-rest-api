import prisma from '../../core/configs/db.js';

const WishlistModel = {
  create: async (data, db = prisma) => {
    return await db.wishlists.create({
      data,
    });
  },

  findById: async (id, db = prisma) => {
    return await db.wishlists.findUnique({
      where: { id },
    });
  },

  findByProductId: async (id, db = prisma) => {
    return await db.wishlists.findFirst({
      where: { product_id: id },
    });
  },

  findByCustomerId: async (
    { customerId, sortOrder, limit, cursor },
    db = prisma
  ) => {
    const cursorClause = cursor ? { id: cursor } : undefined;

    return await db.wishlists.findMany({
      where: {
        customer_id: customerId,
      },
      select: {
        id: true,
        added_at: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            base_price: true,
            is_active: true,
            images: {
              where: { is_primary: true },
              select: {
                id: true,
                key: true,
                url: true,
                alt_text: true,
                is_primary: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ added_at: sortOrder }, { id: sortOrder }],
      take: limit + 1,
      ...(cursorClause && { cursor: cursorClause }),
      skip: cursorClause ? 1 : 0,
    });
  },

  countBy: (where, db = prisma) => db.wishlists.count({ where }),

  deleteBy: async (id, db = prisma) => {
    return await db.wishlists.delete({
      where: { id },
    });
  },
};

export default WishlistModel;
