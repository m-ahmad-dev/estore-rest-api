import prisma from '../../core/configs/db.js';

const PAYMENT_SELECT_FIELDS = {
  id: true,
  order_id: true,
  transaction_id: true,
  checkout_session_id: true,
  attempt_id: true,
  checkout_url: true,
  status: true,
  method: true,
  amount: true,
  paid_at: true,
};

export const PaymentModel = {
  create: async (data, db = prisma) =>
    db.payments.create({ data, select: PAYMENT_SELECT_FIELDS }),

  update: async (where = {}, data, db = prisma) =>
    db.payments.update({
      where,
      data,
      select: PAYMENT_SELECT_FIELDS,
    }),

  findByOrderId: async (orderId, db = prisma) =>
    db.payments.findFirst({
      where: { order_id: orderId },
      select: PAYMENT_SELECT_FIELDS,
    }),

  updateByOrderId: async (where = {}, data, db = prisma) =>
    db.payments.updateMany({ where, data }),
};
