import prisma from '../../core/configs/db.js';

const PAYMENT_SELECT_FIELDS = {
  id: true,
  order_id: true,
  transaction_id: true,
  status: true,
  method: true,
  amount: true,
  paid_at: true,
};

export const PaymentModel = {
  create: async (data, db = prisma) => {
    return await db.payments.create({
      data,
      select: PAYMENT_SELECT_FIELDS,
    });
  },

  updateByTransactionId: async (transactionId, data, db = prisma) => {
    return db.payments.update({
      where: { transaction_id: transactionId },
      data,
      select: PAYMENT_SELECT_FIELDS,
    });
  },

  findByOrderId: async (orderId, db = prisma) => {
    return await db.payments.findFirst({
      where: { order_id: orderId },
      select: PAYMENT_SELECT_FIELDS,
    });
  },
};
