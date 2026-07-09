import { Prisma } from '@prisma/client';
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

  // Admin: Fetch reviews with advanced filtering + Full-Text Search
  findAllForAdmin: async (options = {}, db = prisma) => {
    const {
      cursor,
      limit = 20,
      status,
      rating,
      customer_id,
      product_id,
      search,
      sort = 'created_at',
      order = 'desc',
    } = options;

    const conditions = [];

    // Dynamic WHERE conditions
    if (status) {
      conditions.push(Prisma.sql`r.status = ${status}`);
    }
    if (rating !== undefined) {
      conditions.push(Prisma.sql`r.rating = ${rating}`);
    }
    if (customer_id) {
      conditions.push(Prisma.sql`r.customer_id = ${customer_id}`);
    }
    if (product_id) {
      conditions.push(Prisma.sql`r.product_id = ${product_id}`);
    }
    if (search?.trim()) {
      conditions.push(
        Prisma.sql`r.search_vector @@ plainto_tsquery('english', ${search.trim()})`
      );
    }
    if (cursor) {
      conditions.push(Prisma.sql`r.id > ${cursor}`);
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const sortDirection =
      order.toUpperCase() === 'ASC'
        ? Prisma.sql`ASC`
        : Prisma.sql`DESC`;

    return await db.$queryRaw`
      SELECT 
        r.id,
        r.title,
        r.comment,
        r.status,
        r.rating,
        r.created_at,
        r.helpful_count,
        r.verified_purchase,
        p.id as product_id,
        p.name as product_name,
        p.slug as product_slug,
        c.id as customer_id,
        c.first_name,
        c.last_name,
        c.email as customer_email
      FROM "reviews" r
      JOIN "products" p ON p.id = r.product_id
      JOIN "customers" c ON c.id = r.customer_id
      ${whereClause}
      ORDER BY r.${Prisma.raw(sort)} ${sortDirection}, r.id ASC
      LIMIT ${limit + 1}
    `;
  },

  findWithDetails: async (where, db = prisma) => {
    return await db.reviews.findUnique({
      where,
      select: {
        ...DEFAULT_SELECTS,
        customer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            is_active: true,
            created_at: true,
          },
        },
        order: {
          select: {
            id: true,
            order_number: true,
            status: true,
            placed_at: true,
          },
        },
      },
    });
  },
};

export default ReviewsModel;
