import { PaymentModel } from './payment.model.js';

export const createPaymentRecord = async (paymentData, client) =>
  PaymentModel.create(paymentData, client);

export const updatePaymentByTransactionId = async (
  transactionId,
  payload,
  client
) =>
  PaymentModel.update({ transaction_id: transactionId }, payload, client);

export const findPaymentByOrderId = async (orderId, client) =>
  PaymentModel.findByOrderId(orderId, client);

export const updatePaymentRecordByOrder = async (
  orderId,
  payload,
  client
) =>
  PaymentModel.updateByOrderId({ order_id: orderId }, payload, client);

/**
 * Maintain one current payment-attempt record per order. Payment intents are
 * linked after Stripe confirms which intent was actually created; checkout
 * session IDs/URLs are persisted before redirect so payment can be retried.
 */
export const upsertPaymentRecordForOrder = async (
  orderId,
  payload,
  client
) => {
  const existing = await PaymentModel.findByOrderId(orderId, client);
  if (existing) {
    return PaymentModel.update({ id: existing.id }, payload, client);
  }
  return PaymentModel.create({ order_id: orderId, ...payload }, client);
};

export const prepareCheckoutAttemptForOrder = async (
  orderId,
  { attemptId, amount },
  client
) =>
  upsertPaymentRecordForOrder(
    orderId,
    {
      method: 'CARD',
      status: 'UNPAID',
      amount,
      transaction_id: null,
      checkout_session_id: null,
      checkout_url: null,
      attempt_id: attemptId,
      paid_at: null,
    },
    client
  );

export const saveCheckoutSessionForOrder = async (
  orderId,
  { sessionId, checkoutUrl, attemptId, amount },
  client
) =>
  upsertPaymentRecordForOrder(
    orderId,
    {
      method: 'CARD',
      status: 'UNPAID',
      amount,
      transaction_id: null,
      checkout_session_id: sessionId,
      checkout_url: checkoutUrl,
      attempt_id: attemptId,
      paid_at: null,
    },
    client
  );
