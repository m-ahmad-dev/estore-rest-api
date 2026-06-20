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
    return db.orders.create({
      data,
      select: data.customer_id
        ? CUSTOMER_ORDER_SELECTS
        : GUEST_ORDER_SELECTS,
    });
  },

  async findById(id, db = prisma) {
    return db.orders.findUnique({
      where: { id },
      include: { customer: true },
    });
  },

  async updateStatus(id, updateData, db = prisma) {
    return db.orders.update({
      where: { id },
      data: updateData,
    });
  },
};

export const OrderItemModel = {
  async insertMany(data, db = prisma) {
    return db.order_items.createManyAndReturn({
      data,
      select: ORDER_ITEM_SELECTS,
      skipDuplicates: true,
    });
  },

  async findByOrderId(orderId, db = prisma) {
    return db.order_items.findMany({
      where: { order_id: orderId },
    });
  },
};
