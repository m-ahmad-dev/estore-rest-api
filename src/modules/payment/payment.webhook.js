import Stripe from 'stripe';
import * as orderService from '../orders/order.service.js';
import * as prodVariantServices from '../../modules/products/variants/variants.service.js';
import { updatePaymentByTransactionId } from './payment.service.js';
import executeTransaction from '../../core/utils/dbTransaction.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Executes payment success handling inside an active DB transaction
 */
const handleSuccessfulPayment = async (paymentIntent, client) => {
  const orderId = paymentIntent.metadata?.order_id;

  await orderService.updateOrderStatus(
    orderId,
    { status: 'PROCESSING', payment_status: 'PAID' },
    client
  );

  await updatePaymentByTransactionId(
    paymentIntent.id,
    { status: 'PAID', paid_at: new Date() },
    client
  );

  const orderItems = await orderService.findItemsByOrderId(
    orderId,
    client
  );

  for (const item of orderItems) {
    await prodVariantServices.decreaseProductStockAndReverved(
      item.variant_id,
      item.quantity,
      client
    );
  }
};

/**
 * Executes payment failure/cancellation handling inside an active DB transaction
 */
const handleFailedPayment = async (paymentIntent, client) => {
  const orderId = paymentIntent.metadata?.order_id;

  await orderService.updateOrderStatus(
    orderId,
    { status: 'CANCELLED', payment_status: 'UNPAID' },
    client
  );

  await updatePaymentByTransactionId(
    paymentIntent.id,
    { status: 'UNPAID' },
    client
  );

  const orderItems = await orderService.findItemsByOrderId(
    orderId,
    client
  );

  for (const item of orderItems) {
    await prodVariantServices.releaseProductReservation(
      item.variant_id,
      item.quantity,
      client
    );
  }
};

/**
 * Main Stripe Webhook Controller
 */
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.warn(
      `Webhook signature verification failed: ${err.message}`
    );
    return res.status(400).json({
      success: false,
      message: 'Webhook signature verification failed.',
    });
  }

  const paymentIntent = event.data.object;
  const orderId = paymentIntent.metadata?.order_id;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Missing order_id in payment intent metadata.',
    });
  }

  try {
    // Process inside a single database transaction
    if (event.type === 'payment_intent.succeeded') {
      await executeTransaction(async (client) => {
        await handleSuccessfulPayment(paymentIntent, client);
      });
    } else if (
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'payment_intent.canceled'
    ) {
      await executeTransaction(async (client) => {
        await handleFailedPayment(paymentIntent, client);
      });
    }

    return res.json({ received: true });
  } catch (error) {
    console.error(
      `[WEBHOOK ERROR] Failed to process event ${event.type} for Order ${orderId}:`,
      error
    );
    // Returning 500 tells Stripe to retry delivering the webhook later
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing webhook.',
    });
  }
};
