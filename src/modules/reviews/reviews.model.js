import prisma from '../../core/configs/db.js';

const DEFAULT_SELECTS = {
  id: true,
  customer_id: true,
  product_id: true,
  order_id: true,
  rating: true,
  title: true,
  comment: true,
  status: true,
  rejection_reason: true,
  verified_purchase: true,
  helpful_count: true,
  created_at: true,
  updated_at: true,
  approved_at: true,
  approved_by: true,
  author_id: true,
};

const ReviewsModel = {
  create: async (data, db = prisma) => {
    return await db.reviews.create({
      data,
      select: DEFAULT_SELECTS,
    });
  },

  findById: async (id, db = prisma) => {
    return await db.reviews.findUnique({
      where: { id },
      select: DEFAULT_SELECTS,
    });
  },

  findByComposite: async (criteria, db = prisma) => {
    return await db.reviews.findUnique({
      where: {
        customer_id_product_id_order_id: {
          customer_id: criteria.customer_id || criteria.customerId,
          product_id: criteria.product_id || criteria.productId,
          order_id: criteria.order_id || criteria.orderId,
        },
      },
      select: DEFAULT_SELECTS,
    });
  },

  findWithPagination: async (options = {}, db = prisma) => {
    const { where, take, skip, cursor, orderBy } = options;

    return await db.reviews.findMany({
      where,
      take,
      ...(skip !== undefined && { skip }),
      ...(cursor && { cursor }),
      orderBy: orderBy || { created_at: 'desc' },
      select: {
        ...DEFAULT_SELECTS,
        customer: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  },

  update: async (where, data, db = prisma) => {
    return await db.reviews.update({
      where,
      data,
      select: DEFAULT_SELECTS,
    });
  },

  deleteById: async (id, db = prisma) => {
    return await db.reviews.delete({
      where: { id },
    });
  },

  countBy: async (where = undefined, db = prisma) => {
    return await db.reviews.count({
      where,
    });
  },

  stats: async (productId, db = prisma) => {
    const result = await db.reviews.aggregate({
      where: {
        product_id: productId,
        status: 'APPROVED',
      },
      _avg: { rating: true },
      _count: { id: true },
    });

    return {
      averageRating: result._avg.rating
        ? parseFloat(result._avg.rating.toFixed(1))
        : 0,
      totalReviews: result._count.id,
    };
  },
};

export default ReviewsModel;
