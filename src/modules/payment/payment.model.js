import prisma from '../../core/configs/db.js';

export const PaymentModel = {
  async create(data, tx = prisma) {
    return tx.payments.create({ data });
  },

  async updateByTransactionId(transactionId, data, tx = prisma) {
    return tx.payments.update({
      where: { transaction_id: transactionId },
      data,
    });
  },
};
