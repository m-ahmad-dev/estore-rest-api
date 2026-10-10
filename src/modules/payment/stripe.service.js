import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import AppError from '../../core/utils/error.utils.js';
import env from '../../core/configs/env.js';
import { getStorefrontUrl } from '../../core/utils/url.utils.js';
import { findOrderById } from '../orders/order.service.js';
import {
  findPaymentByOrderId,
  prepareCheckoutAttemptForOrder,
  saveCheckoutSessionForOrder,
  updatePaymentByTransactionId,
  updatePaymentRecordByOrder,
} from './payment.service.js';

let stripeClient;

export const getStripeClient = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(
      'Card payments are not configured on this store.',
      503,
      { errorCode: 'PAYMENT_NOT_CONFIGURED' }
    );
  }

  if (!stripeClient) stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
};

const getCheckoutReturnUrls = (order, storefrontUrl) => {
  const isGuest = !order.customer_id;
  const destination = isGuest
    ? `${storefrontUrl}/orders/track`
    : `${storefrontUrl}/orders/${encodeURIComponent(order.id)}`;

  const buildUrl = (paymentState, includeSessionId = false) => {
    const url = new URL(destination);
    url.searchParams.set('payment', paymentState);
    if (isGuest) url.searchParams.set('order_number', order.order_number);
    if (includeSessionId) {
      // Stripe replaces this template with the actual Checkout Session ID.
      url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
    }
    return url.toString();
  };

  return {
    successUrl: buildUrl('success', true),
    cancelUrl: buildUrl('cancelled'),
  };
};

export const processOrderPaymentIntent = async (orderId) => {
  const stripe = getStripeClient();
  const order = await findOrderById(orderId);

  if (!order) {
    throw AppError.notFound('Order', 'Order not found for payment processing.');
  }
  if (order.status !== 'PENDING' || order.payment_status === 'PAID') {
    throw AppError.badRequest('This order is not eligible for card payment.');
  }
  if (order.payment_method !== 'CARD') {
    throw AppError.badRequest('Checkout is only applicable to card payments.');
  }

  const amountInCents = Math.round(Number(order.total_amount) * 100);
  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    throw AppError.badRequest('The order total must be greater than zero for card payment.');
  }

  const storefrontUrl = getStorefrontUrl();
  if (!storefrontUrl) {
    throw new AppError(
      'STORE_FRONTEND_URL must be configured before card payments can be enabled.',
      503,
      { errorCode: 'PAYMENT_NOT_CONFIGURED' }
    );
  }

  const existingPayment = await findPaymentByOrderId(orderId);
  if (existingPayment?.checkout_session_id) {
    const existingSession = await stripe.checkout.sessions.retrieve(
      existingPayment.checkout_session_id
    );

    if (existingSession.status === 'open' && existingSession.url) {
      return {
        checkoutUrl: existingSession.url,
        sessionId: existingSession.id,
      };
    }

    // Completed sessions are never replaced while the webhook may still be in
    // flight; creating another session here could cause a duplicate charge.
    if (existingSession.status === 'complete') {
      throw AppError.conflict(
        'Payment is already being processed. Refresh the order status before retrying.'
      );
    }
  }

  const { successUrl, cancelUrl } = getCheckoutReturnUrls(
    order,
    storefrontUrl
  );
  const currency = String(env.STRIPE_CURRENCY || 'pkr').toLowerCase();
  let attemptId = !existingPayment?.checkout_session_id && existingPayment?.attempt_id
    ? existingPayment.attempt_id
    : randomUUID();
  let session;

  // Persist an attempt token before calling Stripe. If the network drops after
  // Stripe creates the session, the next request can safely reuse the same
  // idempotency key rather than creating a second live Checkout Session.
  for (let attemptNumber = 0; attemptNumber < 3; attemptNumber += 1) {
    await prepareCheckoutAttemptForOrder(orderId, {
      attemptId,
      amount: order.total_amount,
    });

    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: !order.customer_id ? order.guest_email : undefined,
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: `Order ${order.order_number}` },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          payment_attempt_id: attemptId,
        },
        payment_intent_data: {
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
            payment_attempt_id: attemptId,
          },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      { idempotencyKey: `order-${order.id}-attempt-${attemptId}` }
    );

    if (session.status !== 'expired') break;
    // A previous request may have created this session but failed while saving
    // it. Do not redirect to an already-expired URL; create a fresh attempt.
    attemptId = randomUUID();
  }

  if (!session || session.status !== 'open' || !session.url) {
    throw AppError.conflict(
      'Stripe did not return an active checkout session. Please retry payment.'
    );
  }

  try {
    await saveCheckoutSessionForOrder(orderId, {
      sessionId: session.id,
      checkoutUrl: session.url,
      attemptId,
      amount: order.total_amount,
    });
  } catch (error) {
    // Avoid leaving a live, untracked checkout session after a database error.
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch (expireError) {
      console.error(
        `[STRIPE WARN] Could not expire untracked Checkout Session ${session.id}:`,
        expireError.message
      );
    }
    throw error;
  }

  return { checkoutUrl: session.url, sessionId: session.id };
};

/** Expires an unpaid Checkout Session. A paid/complete session must not be
 * silently discarded because its webhook may not have been delivered yet. */
export const cancelStripeCheckoutSession = async (sessionId) => {
  if (!sessionId) return { expired: false, missing: true };

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.status === 'expired') return { expired: true };
  if (session.status === 'complete' || session.payment_status === 'paid') {
    throw AppError.conflict(
      'Payment has already completed or is processing. Refresh the order before cancelling it.'
    );
  }

  await stripe.checkout.sessions.expire(sessionId);
  return { expired: true };
};

export const cancelStripePaymentIntent = async (transactionId) => {
  const stripe = getStripeClient();
  try {
    const currentIntent = await stripe.paymentIntents.retrieve(transactionId);
    if (currentIntent.status === 'succeeded') {
      throw AppError.conflict(
        'This payment has already succeeded. Use the refund workflow instead of cancelling it.'
      );
    }
    if (currentIntent.status === 'canceled') {
      await updatePaymentByTransactionId(transactionId, { status: 'CANCELLED' });
      return { success: true, status: 'canceled' };
    }

    const paymentIntent = await stripe.paymentIntents.cancel(transactionId);
    await updatePaymentByTransactionId(transactionId, { status: 'CANCELLED' });
    return { success: true, status: paymentIntent.status };
  } catch (error) {
    if (error?.statusCode === 409 || error?.status === 409) throw error;
    console.warn(`[STRIPE WARN] Failed to cancel PaymentIntent ${transactionId}: ${error.message}`);
    throw error;
  }
};

export const refundStripePayment = async (
  transactionId,
  amount,
  idempotencyKey = `order-refund-${transactionId}-${Math.round(Number(amount) * 100)}`,
  { updatePaymentRecord = true } = {}
) => {
  const stripe = getStripeClient();
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: transactionId,
        amount: Math.round(Number(amount) * 100),
      },
      { idempotencyKey }
    );
    if (updatePaymentRecord) {
      await updatePaymentByTransactionId(transactionId, {
        status: 'REFUNDED',
        checkout_url: null,
      });
    }
    return refund;
  } catch (error) {
    console.error(`[STRIPE ERROR] Refund failed for ${transactionId}:`, error.message);
    throw error;
  }
};

export const markPaymentCancelledByOrder = async (orderId, client) =>
  updatePaymentRecordByOrder(orderId, {
    status: 'CANCELLED',
    checkout_url: null,
  }, client);
