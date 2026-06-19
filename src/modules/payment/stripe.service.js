import Stripe from 'stripe';
import AppError from '../../core/utils/error.utils.js';
import { findOrderById } from '../orders/order.service.js';
import { createPaymentRecord } from './payment.service.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const DEFAULT_CURRENCY = 'usd';

export const processOrderPaymentIntent = async (orderId) => {
  const order = await findOrderById(orderId);

  if (!order) {
    throw AppError.notFound(
      'Order',
      'Order not found for payment processing.'
    );
  }

  if (order.status !== 'PENDING') {
    throw AppError.badRequest(
      'Invalid order status for payment processing.'
    );
  }

  if (order.payment_method !== 'CARD') {
    throw AppError.badRequest(
      'Payment intent is only applicable for CARD payments.'
    );
  }

  const amountInCents = Math.round(Number(order.total_amount) * 100);
  if (amountInCents <= 0) {
    throw AppError.badRequest('Invalid order amount for payment.');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: DEFAULT_CURRENCY,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
    },
    capture_method: 'automatic',
  });

  await createPaymentRecord({
    order_id: order.id,
    method: order.payment_method,
    status: 'UNPAID',
    amount: order.total_amount,
    transaction_id: paymentIntent.id,
  });

  return {
    clientSecret: paymentIntent.client_secret,
  };
};
