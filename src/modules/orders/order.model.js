import prisma from '../../core/configs/db.js';

const GUEST_ORDER_SELECTS = {
  id: true,
  order_number: true,
  guest_name: true,
  guest_email: true,
  guest_phone: true,
  guest_address: true,
  status: true,
  payment_method: true,
  payment_status: true,
  subtotal: true,
  discount_amount: true,
  shipping_cost: true,
  total_amount: true,
  placed_at: true,
};

const CUSTOMER_ORDER_SELECTS = {
  id: true,
  customer_id: true,
  order_number: true,
  status: true,
  payment_method: true,
  payment_status: true,
  subtotal: true,
  discount_amount: true,
  shipping_cost: true,
  total_amount: true,
  placed_at: true,
};

const ORDER_ITEM_SELECTS = {
  id: true,
  order_id: true,
  variant_id: true,
  product_name: true,
  sku: true,
  variant_options: true,
  quantity: true,
  unit_price: true,
  total_price: true,
};

export const OrderModel = {
  async create(data, db = prisma) {
    return await db.orders.create({
      data,
      select: data.customer_id
        ? CUSTOMER_ORDER_SELECTS
        : GUEST_ORDER_SELECTS,
    });
  },

  async findById(id, db = prisma) {
    return await db.orders.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });
  },

  async update(id, updateData, db = prisma) {
    return await db.orders.update({
      where: { id },
      data: updateData,
    });
  },

  findWithDetails: async (where, db = prisma) => {
    return await db.orders.findUnique({
      where,
      include: {
        items: { select: ORDER_ITEM_SELECTS },
        shipments: {
          select: {
            id: true,
            order_id: true,
            status: true,
            carrier: true,
            tracking_number: true,
            transaction_id: true,
            label_url: true,
            delivered_at: true,
            shipped_at: true,
          },
        },
        payments: {
          select: {
            id: true,
            order_id: true,
            status: true,
            method: true,
            amount: true,
            transaction_id: true,
            paid_at: true,
          },
        },
      },
    });
  },

  /**
   * Flexible findMany with support for cursor pagination and filters
   * @param {Object} options - Query options
   * @param {Object} [db=prisma] - Prisma client instance
   */
  findMany: async (options = {}, db = prisma) => {
    const {
      where = {},
      orderBy = [{ placed_at: 'desc' }, { id: 'desc' }],
      cursor,
      take = 15,
      include = { items: { select: { id: true } } },
    } = options;

    const query = {
      where,
      orderBy,
      take: take + 1,
      include,
    };

    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    }

    return await db.orders.findMany(query);
  },
};

export const OrderItemModel = {
  async insertMany(data, db = prisma) {
    return await db.order_items.createManyAndReturn({
      data,
      select: ORDER_ITEM_SELECTS,
      skipDuplicates: true,
    });
  },

  async findByOrderId(orderId, db = prisma) {
    return await db.order_items.findMany({
      where: { order_id: orderId },
    });
  },
};
