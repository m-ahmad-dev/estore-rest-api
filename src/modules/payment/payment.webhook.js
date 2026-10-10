import * as orderService from '../orders/order.service.js';
import * as prodVariantServices from '../products/variants/variants.service.js';
import * as shipmentService from '../shipments/shipments.service.js';
import { fireBackgroundTask } from '../../core/utils/async_worker.utils.js';
import { decrementCouponUsage } from '../coupons/coupons.service.js';
import {
  findPaymentByOrderId,
  upsertPaymentRecordForOrder,
  updatePaymentRecordByOrder,
} from './payment.service.js';
import {
  getStripeClient,
  refundStripePayment,
} from './stripe.service.js';
import env from '../../core/configs/env.js';
import executeTransaction from '../../core/utils/dbTransaction.js';

const handleSuccessfulPayment = async (paymentIntent, client) => {
  const orderId = paymentIntent.metadata?.order_id;
  const order = await orderService.findOrderById(orderId, client);

  if (!order) throw new Error(`Order ${orderId} was not found for Stripe PaymentIntent ${paymentIntent.id}.`);
  if (order.status === 'CANCELLED') throw new Error('Order was cancelled before payment could be applied.');

  const currentPayment = await findPaymentByOrderId(orderId, client);
  const eventAttemptId = paymentIntent.metadata?.payment_attempt_id;
  if (
    eventAttemptId && currentPayment?.attempt_id &&
    eventAttemptId !== currentPayment.attempt_id
  ) {
    throw new Error(`Stale payment attempt ${eventAttemptId} cannot fulfil order ${orderId}.`);
  }
  if (order.payment_status === 'PAID') return { alreadyProcessed: true };

  // Atomically claim the transition before touching inventory. Duplicate and
  // concurrent webhook deliveries cannot decrement the same reservation twice.
  const transition = await client.orders.updateMany({
    where: {
      id: orderId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      payment_status: { not: 'PAID' },
    },
    data: { status: 'PROCESSING', payment_status: 'PAID' },
  });

  if (transition.count === 0) {
    const latestOrder = await orderService.findOrderById(orderId, client);
    if (latestOrder?.payment_status === 'PAID') return { alreadyProcessed: true };
    throw new Error(`Order ${orderId} is not in a payable state.`);
  }

  await upsertPaymentRecordForOrder(
    orderId,
    {
      method: 'CARD',
      status: 'PAID',
      amount: order.total_amount,
      transaction_id: paymentIntent.id,
      paid_at: new Date(),
      checkout_url: null,
    },
    client
  );

  const orderItems = await orderService.findItemsByOrderId(orderId, client);
  for (const item of orderItems) {
    await prodVariantServices.decreaseProductStockAndReverved(
      item.variant_id,
      item.quantity,
      client
    );
  }

  return { alreadyProcessed: false };
};

const handleFailedPayment = async (paymentIntent, client) => {
  const orderId = paymentIntent.metadata?.order_id;
  const order = await orderService.findOrderById(orderId, client);

  if (!order) throw new Error(`Order ${orderId} was not found for Stripe PaymentIntent ${paymentIntent.id}.`);
  // A delayed event from an earlier checkout attempt must not overwrite the
  // metadata/status of the currently active attempt.
  const currentPayment = await findPaymentByOrderId(orderId, client);
  const eventAttemptId = paymentIntent.metadata?.payment_attempt_id;
  if (
    eventAttemptId && currentPayment?.attempt_id &&
    eventAttemptId !== currentPayment.attempt_id
  ) return;
  // A failed payment attempt is not the same as a cancelled order. Stripe
  // Checkout can allow another card attempt within the same Checkout Session.
  if (order.status === 'CANCELLED' || order.payment_status === 'PAID') return;

  await upsertPaymentRecordForOrder(
    orderId,
    {
      method: 'CARD',
      status: 'UNPAID',
      amount: order.total_amount,
      transaction_id: paymentIntent.id,
      paid_at: null,
    },
    client
  );
};

const cancelUnpaidOrderAndReleaseStock = async (orderId, client, paymentPayload = {}) => {
  const transition = await client.orders.updateMany({
    where: {
      id: orderId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      payment_status: { not: 'PAID' },
    },
    data: { status: 'CANCELLED', payment_status: 'CANCELLED' },
  });

  if (transition.count === 0) return false;

  const items = await orderService.findItemsByOrderId(orderId, client);
  for (const item of items) {
    await prodVariantServices.releaseProductReservation(
      item.variant_id,
      item.quantity,
      client
    );
  }

  const cancelledOrder = await orderService.findOrderById(orderId, client);
  if (cancelledOrder?.coupon_id) {
    await decrementCouponUsage(cancelledOrder.coupon_id, client);
  }

  await shipmentService.updateShippingByOrderId(
    orderId,
    { status: 'CANCELLED' },
    client
  );

  if (paymentPayload.transaction_id) {
    const order = await orderService.findOrderById(orderId, client);
    await upsertPaymentRecordForOrder(
      orderId,
      {
        method: 'CARD',
        status: 'CANCELLED',
        amount: order.total_amount,
        transaction_id: paymentPayload.transaction_id,
        paid_at: null,
        checkout_url: null,
      },
      client
    );
  } else {
    await updatePaymentRecordByOrder(
      orderId,
      { status: 'CANCELLED', checkout_url: null },
      client
    );
  }

  return true;
};

const handleCanceledPaymentIntent = async (paymentIntent, client) => {
  const orderId = paymentIntent.metadata?.order_id;
  const order = await orderService.findOrderById(orderId, client);
  if (!order) throw new Error(`Order ${orderId} was not found for Stripe PaymentIntent ${paymentIntent.id}.`);
  if (order.status === 'CANCELLED' || order.payment_status === 'PAID') return;

  const currentPayment = await findPaymentByOrderId(orderId, client);
  const eventAttemptId = paymentIntent.metadata?.payment_attempt_id;
  if (
    eventAttemptId && currentPayment?.attempt_id &&
    eventAttemptId !== currentPayment.attempt_id
  ) return;

  // A PaymentIntent can be canceled because one attempt failed/expired. Only
  // checkout.session.expired is allowed to release reservations and cancel the
  // order, because that event can be matched to the currently stored session.
  await upsertPaymentRecordForOrder(
    orderId,
    {
      method: 'CARD',
      status: 'UNPAID',
      amount: order.total_amount,
      transaction_id: paymentIntent.id,
      paid_at: null,
    },
    client
  );
};

const handleExpiredCheckoutSession = async (session, client) => {
  const orderId = session.metadata?.order_id;
  const order = await orderService.findOrderById(orderId, client);
  if (!order) throw new Error(`Order ${orderId} was not found for Checkout Session ${session.id}.`);

  const currentPayment = await findPaymentByOrderId(orderId, client);
  // Stripe can deliver events out of order after the customer has retried.
  if (currentPayment?.checkout_session_id !== session.id) return;
  if (order.status === 'CANCELLED' || order.payment_status === 'PAID') return;

  await cancelUnpaidOrderAndReleaseStock(orderId, client);
};

export const handleStripeWebhook = async (req, res) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('[STRIPE CONFIG] STRIPE_WEBHOOK_SECRET is not configured.');
    return res.status(503).json({
      success: false,
      message: 'Payment webhook is not configured.',
    });
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.warn(`Stripe webhook signature/configuration validation failed: ${error.message}`);
    return res.status(400).json({
      success: false,
      message: 'Webhook signature verification failed.',
    });
  }

  const handledEvents = new Set([
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.canceled',
    'checkout.session.expired',
  ]);
  if (!handledEvents.has(event.type)) return res.json({ received: true });

  const payload = event.data.object;
  const orderId = payload.metadata?.order_id;
  if (!orderId) {
    console.warn(`Stripe event ${event.type} received without order_id metadata.`);
    return res.json({ received: true, ignored: true });
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const order = await orderService.findOrderById(orderId);
      if (!order) {
        console.error(`Stripe PaymentIntent ${payload.id} references missing order ${orderId}.`);
        return res.json({ received: true, ignored: true });
      }

      const expectedAmount = Math.round(Number(order.total_amount) * 100);
      const receivedAmount = Number(payload.amount_received ?? payload.amount);
      const expectedCurrency = String(env.STRIPE_CURRENCY || 'pkr').toLowerCase();
      if (
        receivedAmount !== expectedAmount ||
        String(payload.currency || '').toLowerCase() !== expectedCurrency
      ) {
        console.error(
          `[STRIPE SECURITY] Amount/currency mismatch for order ${orderId}. Expected ${expectedAmount} ${expectedCurrency}; received ${receivedAmount} ${payload.currency}.`
        );
        // A valid but mismatched event should not be retried indefinitely or
        // advance fulfillment. It requires an operator investigation.
        return res.json({ received: true, ignored: true });
      }

      const currentPayment = await findPaymentByOrderId(orderId);
      const eventAttemptId = payload.metadata?.payment_attempt_id;
      if (
        order.status !== 'CANCELLED' && eventAttemptId && currentPayment?.attempt_id &&
        eventAttemptId !== currentPayment.attempt_id
      ) {
        // A charge from an expired checkout attempt must not pay for/fulfil the
        // current attempt or overwrite its session record. Refund it safely.
        await refundStripePayment(
          payload.id,
          Number(order.total_amount),
          `stale-payment-attempt-${orderId}-${payload.id}`,
          { updatePaymentRecord: false }
        );
        return res.json({ received: true, refunded: true, staleAttempt: true });
      }

      if (order.status === 'CANCELLED') {
        // Stripe can redeliver semantically identical success events with a new
        // event ID. Persisted REFUNDED state plus a Stripe idempotency key keeps
        // those deliveries from issuing a second refund.
        const priorPayment = await findPaymentByOrderId(orderId);
        if (
          priorPayment?.transaction_id === payload.id &&
          priorPayment?.status === 'REFUNDED'
        ) {
          return res.json({ received: true, refunded: true, alreadyRefunded: true });
        }

        await executeTransaction(async (client) => {
          await upsertPaymentRecordForOrder(
            orderId,
            {
              method: 'CARD',
              status: 'PAID',
              amount: order.total_amount,
              transaction_id: payload.id,
              paid_at: new Date(),
              checkout_url: null,
            },
            client
          );
        });
        await refundStripePayment(
          payload.id,
          Number(order.total_amount),
          `late-cancelled-order-${orderId}-${payload.id}`
        );
        await executeTransaction(async (client) => {
          await updatePaymentRecordByOrder(
            orderId,
            { status: 'REFUNDED', checkout_url: null },
            client
          );
          await client.orders.update({
            where: { id: orderId },
            data: { payment_status: 'REFUNDED' },
          });
        });
        return res.json({ received: true, refunded: true });
      }
    }

    await executeTransaction(async (client) => {
      if (event.type === 'payment_intent.succeeded') {
        await handleSuccessfulPayment(payload, client);
      } else if (event.type === 'payment_intent.payment_failed') {
        await handleFailedPayment(payload, client);
      } else if (event.type === 'payment_intent.canceled') {
        await handleCanceledPaymentIntent(payload, client);
      } else if (event.type === 'checkout.session.expired') {
        await handleExpiredCheckoutSession(payload, client);
      }
    });

    if (event.type === 'payment_intent.succeeded') {
      fireBackgroundTask(async () => {
        try {
          await shipmentService.purchaseAndPersistShipmentLabel(orderId);
        } catch (error) {
          console.error(`[SHIPPO LABEL ERROR] Paid order ${orderId}:`, error.message);
        }
      });
    }

    return res.json({ received: true });
  } catch (error) {
    console.error(
      `[WEBHOOK ERROR] Failed to process ${event.type} for Order ${orderId}:`,
      error
    );
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing webhook.',
    });
  }
};
