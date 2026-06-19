import Stripe from 'stripe';
import executeTransaction from '../../core/utils/dbTransaction.js';
import * as orderService from '../orders/order.service.js';
import * as variantService from '../products/variants/variants.service.js';
import { updatePaymentByTransactionId } from './payment.service.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const handleSuccessfulPayment = async (paymentIntent, client) => {
  await orderService.updateOrderStatus(
    paymentIntent.metadata.order_id,
    { status: 'PROCESSING', payment_status: 'PAID' },
    client
  );

  await updatePaymentByTransactionId(
    paymentIntent.id,
    { status: 'PAID', paid_at: new Date() },
    client
  );

  const orderItems = await orderService.findItemsByOrderId(
    paymentIntent.metadata.order_id,
    client
  );

  for (const item of orderItems) {
    await variantService.decreaseProductStockAndReverved(
      item.variant_id,
      item.quantity,
      client
    );
  }
};

const handleFailedPayment = async (paymentIntent, client) => {
  await orderService.updateOrderStatus(
    paymentIntent.metadata.order_id,
    { status: 'CANCELLED', payment_status: 'UNPAID' },
    client
  );

  await updatePaymentByTransactionId(
    paymentIntent.id,
    { status: 'UNPAID' },
    client
  );

  const orderItems = await orderService.findItemsByOrderId(
    paymentIntent.metadata.order_id,
    client
  );

  for (const item of orderItems) {
    await variantService.releaseProductReservation(
      item.variant_id,
      item.quantity,
      client
    );
  }
};

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
      `Stripe webhook signature verification failed: ${err.message}`
    );
    return res.status(400).json({
      success: false,
      message: 'Webhook signature verification failed.',
    });
  }

  const paymentIntent = event.data.object;
  const orderId = paymentIntent.metadata?.order_id;

  if (!orderId) {
    console.warn(
      'Stripe webhook received without order_id in metadata.'
    );
    return res.status(400).json({
      success: false,
      message: 'Missing order_id in payment intent metadata.',
    });
  }

  try {
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
      console.info(
        `Payment failed/canceled for Order ID: ${orderId}. Stock released.`
      );
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    // Return 500 so Stripe retries
    res.status(500).json({
      success: false,
      message: 'Internal server error while processing webhook.',
    });
  }
};
