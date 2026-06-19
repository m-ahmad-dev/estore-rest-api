import { PaymentModel } from './payment.model.js';

export const createPaymentRecord = async (paymentData) => {
  const paymentRecord = await PaymentModel.create(paymentData);
  return paymentRecord;
};

export const updatePaymentByTransactionId = async (
  transactionId,
  payload,
  client
) => {
  return await PaymentModel.updateByTransactionId(
    transactionId,
    payload,
    client
  );
};
