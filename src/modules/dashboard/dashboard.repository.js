import prisma from '../../core/configs/db.js';

// Create a small helper that counts rows for a given Prisma delegate.
const makeCounter = (delegateName) => {
  return async (where = {}, db = prisma) =>
    db[delegateName].count({ where });
};

const DashboardRepository = {
  orders: {
    // Aggregate revenue and order count values for the provided filter.
    aggregateRevenue: async (where, db = prisma) => {
      const aggregation = await db.orders.aggregate({
        where,
        _sum: { total_amount: true },
        _count: { id: true },
        _avg: { total_amount: true },
      });

      return {
        totalRevenue: Number(aggregation._sum.total_amount || 0),
        orderCount: aggregation._count.id || 0,
        averageOrderValue: Number(aggregation._avg.total_amount || 0),
      };
    },

    count: makeCounter('orders'),

    // Return current and previous revenue totals for a period comparison.
    revenueForPeriods: async (
      { currentStart, previousStart, previousEnd },
      db = prisma
    ) => {
      const [row] = await db.$queryRaw`
        SELECT
          COALESCE(SUM(total_amount) FILTER (WHERE placed_at >= ${currentStart}), 0)::float AS current_revenue,
          COALESCE(SUM(total_amount) FILTER (
            WHERE placed_at >= ${previousStart} AND placed_at < ${previousEnd}
          ), 0)::float AS previous_revenue
        FROM orders
        WHERE status = 'DELIVERED' AND payment_status = 'PAID'
      `;
      return {
        current: row.current_revenue,
        previous: row.previous_revenue,
      };
    },

    // Return current and previous order counts for a period comparison.
    countForPeriods: async (
      { currentStart, previousStart, previousEnd },
      db = prisma
    ) => {
      const [row] = await db.$queryRaw`
        SELECT
          COUNT(*) FILTER (WHERE placed_at >= ${currentStart})::int AS current_count,
          COUNT(*) FILTER (
            WHERE placed_at >= ${previousStart} AND placed_at < ${previousEnd}
          )::int AS previous_count
        FROM orders
      `;
      return {
        current: row.current_count,
        previous: row.previous_count,
      };
    },

    // Build a chart series of revenue and order counts with filled time buckets.
    revenueSeries: async (
      { currentStart, currentEnd, granularity },
      db = prisma
    ) => {
      const rows = await db.$queryRaw`
        SELECT
          bucket,
          COALESCE(SUM(o.total_amount), 0)::float AS revenue,
          COUNT(o.id)::int AS order_count
        FROM generate_series(
          date_trunc(${granularity}, ${currentStart}::timestamp),
          date_trunc(${granularity}, ${currentEnd}::timestamp),
          (${'1 ' + granularity})::interval
        ) AS bucket
        LEFT JOIN orders o
          ON date_trunc(${granularity}, o.placed_at) = bucket
          AND o.status = 'DELIVERED' AND o.payment_status = 'PAID'
          AND o.placed_at >= ${currentStart} AND o.placed_at <= ${currentEnd}
        GROUP BY bucket
        ORDER BY bucket
      `;

      return rows.map((row) => ({
        bucket: row.bucket,
        revenue: row.revenue,
        orderCount: row.order_count,
      }));
    },

    // Aggregate order counts by status for the selected period.
    statusDistributionForPeriod: async (
      { currentStart, currentEnd },
      db = prisma
    ) => {
      const rows = await db.orders.groupBy({
        by: ['status'],
        where: { placed_at: { gte: currentStart, lte: currentEnd } },
        _count: { id: true },
      });

      return rows.map((row) => ({
        status: row.status,
        count: row._count.id,
      }));
    },

    // Aggregate order counts by payment method for the selected period.
    paymentMethodsForPeriod: async (
      { currentStart, currentEnd },
      db = prisma
    ) => {
      const rows = await db.orders.groupBy({
        by: ['payment_method'],
        where: { placed_at: { gte: currentStart, lte: currentEnd } },
        _count: { id: true },
      });

      return rows.map((row) => ({
        method: row.payment_method,
        count: row._count.id,
      }));
    },
  },

  customers: {
    count: makeCounter('customers'),

    // Return current and previous customer counts for a period comparison.
    countForPeriods: async (
      { currentStart, previousStart, previousEnd },
      db = prisma
    ) => {
      const [row] = await db.$queryRaw`
        SELECT
          COUNT(*) FILTER (
            WHERE created_at >= ${currentStart} AND deleted_at IS NULL
          )::int AS current_count,
          COUNT(*) FILTER (
            WHERE created_at >= ${previousStart} 
              AND created_at < ${previousEnd}
              AND deleted_at IS NULL
          )::int AS previous_count
        FROM customers
      `;
      return {
        current: row.current_count,
        previous: row.previous_count,
      };
    },

    // Build a chart series of customer counts with filled time buckets.
    series: async (
      { currentStart, currentEnd, granularity },
      db = prisma
    ) => {
      const rows = await db.$queryRaw`
        SELECT
          bucket,
          COUNT(c.id)::int AS count
        FROM generate_series(
          date_trunc(${granularity}, ${currentStart}::timestamp),
          date_trunc(${granularity}, ${currentEnd}::timestamp),
          (${'1 ' + granularity})::interval
        ) AS bucket
        LEFT JOIN customers c
          ON date_trunc(${granularity}, c.created_at) = bucket
          AND c.created_at >= ${currentStart} AND c.created_at <= ${currentEnd}
        GROUP BY bucket
        ORDER BY bucket
      `;
      return rows.map((row) => ({
        bucket: row.bucket,
        count: row.count,
      }));
    },
  },

  products: {
    count: makeCounter('products'),
  },

  productVariants: {
    // Summarize stock levels for product variants.
    stockBreakdown: async (db = prisma) => {
      const [row] = await db.$queryRaw`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE stock_quantity <= 0)::int AS out_of_stock,
          COUNT(*) FILTER (
            WHERE stock_quantity > 0 AND stock_quantity <= reorder_level
          )::int AS low_stock,
          COUNT(*) FILTER (WHERE stock_quantity > reorder_level)::int AS in_stock
        FROM product_variants
        WHERE deleted_at IS NULL
      `;
      return {
        total: row.total,
        inStock: row.in_stock,
        lowStock: row.low_stock,
        outOfStock: row.out_of_stock,
      };
    },
  },

  reviews: {
    count: makeCounter('reviews'),

    // Return the average review rating across all reviews.
    averageRating: async (db = prisma) => {
      const aggregate = await db.reviews.aggregate({
        _avg: { rating: true },
      });
      return aggregate._avg.rating;
    },
  },

  coupons: {
    count: makeCounter('coupons'),

    // Summarize coupon activity states for the dashboard.
    statusBreakdown: async (now, db = prisma) => {
      const [row] = await db.$queryRaw`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE is_active = true
              AND (starts_at IS NULL OR starts_at <= ${now})
              AND (expires_at IS NULL OR expires_at > ${now})
              AND (max_uses IS NULL OR used_count < max_uses)
          )::int AS active,
          COUNT(*) FILTER (
            WHERE (expires_at IS NOT NULL AND expires_at <= ${now})
               OR (max_uses IS NOT NULL AND used_count >= max_uses)
          )::int AS expired,
          COUNT(*) FILTER (
            WHERE is_active = true AND starts_at > ${now}
          )::int AS scheduled
        FROM coupons
      `;
      return {
        total: row.total,
        active: row.active,
        expired: row.expired,
        scheduled: row.scheduled,
      };
    },
  },

  categories: {
    count: makeCounter('categories'),

    // Return the top categories ranked by revenue for the selected period.
    topByRevenue: async (
      { currentStart, currentEnd },
      limit = 5,
      db = prisma
    ) => {
      const rows = await db.$queryRaw`
        SELECT
          c.id,
          c.name,
          COALESCE(SUM(oi.total_price), 0)::float AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE o.status = 'DELIVERED' AND o.payment_status = 'PAID'
          AND o.placed_at >= ${currentStart} AND o.placed_at <= ${currentEnd}
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
        LIMIT ${limit}
      `;

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        revenue: row.revenue,
      }));
    },
  },

  activity: {
    getRecentEntities: async (limit = 20, db = prisma) => {
      const [
        orders,
        customers,
        products,
        reviews,
        categories,
        coupons,
      ] = await Promise.all([
        db.orders.findMany({
          take: limit,
          orderBy: { placed_at: 'desc' },
          select: {
            id: true,
            order_number: true,
            placed_at: true,
            guest_name: true,
            customer: {
              select: { first_name: true, last_name: true },
            },
          },
        }),
        db.customers.findMany({
          take: limit,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            first_name: true,
            last_name: true,
            created_at: true,
          },
        }),
        db.products.findMany({
          take: limit,
          orderBy: { created_at: 'desc' },
          select: { id: true, name: true, created_at: true },
        }),
        db.reviews.findMany({
          take: limit,
          orderBy: { updated_at: 'desc' }, // Captures both new and recently updated/approved
          select: {
            id: true,
            created_at: true,
            updated_at: true,
            approved_at: true,
            status: true,
            product: { select: { name: true } },
          },
        }),
        db.categories.findMany({
          take: limit,
          orderBy: { updated_at: 'desc' },
          select: {
            id: true,
            name: true,
            created_at: true,
            updated_at: true,
          },
        }),
        db.coupons.findMany({
          take: limit,
          orderBy: { updated_at: 'desc' },
          select: {
            id: true,
            code: true,
            created_at: true,
            updated_at: true,
            is_active: true,
          },
        }),
      ]);

      return {
        orders,
        customers,
        products,
        reviews,
        categories,
        coupons,
      };
    },
  },
};

export default DashboardRepository;
