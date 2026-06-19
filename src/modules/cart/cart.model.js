import prisma from '../../core/configs/db.js';

const CART_SELECT = {
  id: true,
  customer_id: true,
  session_id: true,
  coupon_id: true,
  status: true,
  expires_at: true,
};

const CART_ITEM_SELECT = {
  id: true,
  cart_id: true,
  variant_id: true,
  quantity: true,
  variant: {
    select: {
      id: true,
      product_id: true,
      attributes: true,
      sku: true,
      weight: true,
      price: true,
      stock_quantity: true,
      reserved_quantity: true,
      deleted_at: true,
    },
  },
};

export const CartModel = {
  findActiveByCustomer: (customerId, db = prisma) =>
    db.carts.findFirst({
      where: { customer_id: customerId, status: 'ACTIVE' },
      select: CART_SELECT,
    }),

  findActiveBySession: (sessionId, db = prisma) =>
    db.carts.findFirst({
      where: { session_id: sessionId, status: 'ACTIVE' },
      select: CART_SELECT,
    }),

  create: (customerId, sessionId, db = prisma) =>
    db.carts.create({
      data: {
        customer_id: customerId,
        session_id: sessionId,
        status: 'ACTIVE',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      select: CART_SELECT,
    }),

  update: (cartId, data, db = prisma) =>
    db.carts.update({
      where: { id: cartId },
      data,
      select: CART_SELECT,
    }),

  markAsAbandoned: (cartId, db = prisma) =>
    db.carts.update({
      where: { id: cartId },
      data: { status: 'ABANDONED' },
    }),
};

export const CartItemModel = {
  findByCart: (cartId, db = prisma) =>
    db.cart_items.findMany({
      where: { cart_id: cartId },
      select: CART_ITEM_SELECT,
    }),

  findByCartAndVariant: (cartId, variantId, db = prisma) =>
    db.cart_items.findUnique({
      where: {
        cart_id_variant_id: {
          cart_id: cartId,
          variant_id: variantId,
        },
      },
      select: CART_ITEM_SELECT,
    }),

  findByCartAndId: (cartId, itemId, db = prisma) =>
    db.cart_items.findUnique({
      where: {
        id: itemId,
        cart_id: cartId,
      },
      select: CART_ITEM_SELECT,
    }),

  create: (cartId, variantId, quantity, db = prisma) =>
    db.cart_items.create({
      data: {
        cart_id: cartId,
        variant_id: variantId,
        quantity,
      },
      select: CART_ITEM_SELECT,
    }),

  update: (itemId, data, db = prisma) =>
    db.cart_items.update({
      where: { id: itemId },
      data,
      select: CART_ITEM_SELECT,
    }),

  delete: (itemId, db = prisma) =>
    db.cart_items.delete({ where: { id: itemId } }),

  deleteByCart: (cartId, db = prisma) =>
    db.cart_items.deleteMany({ where: { cart_id: cartId } }),

  countByCart: (cartId, db = prisma) =>
    db.cart_items.count({ where: { cart_id: cartId } }),
};
