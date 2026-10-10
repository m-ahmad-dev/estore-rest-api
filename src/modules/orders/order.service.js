import crypto from 'crypto';
import AppError from '../../core/utils/error.utils.js';
import executeTransaction from '../../core/utils/dbTransaction.js';
import * as cartService from '../cart/cart.service.js';
import * as addressService from '../address/address.service.js';
import * as shipmentService from '../shipments/shipments.service.js';
import * as prodVariantService from '../products/variants/variants.service.js';
import * as shippoService from '../shipments/shippo.service.js';
import * as stripeService from '../payment/stripe.service.js';
import * as paymentService from '../payment/payment.service.js';
import { fireBackgroundTask } from '../../core/utils/async_worker.utils.js';
import { findCustomerById } from '../customer/customer.service.js';
import { OrderModel, OrderItemModel } from './order.model.js';
import {
  decrementCouponUsage,
  findCouponById,
  incrementCouponUsage,
  validateAndCalculateDiscount,
} from '../coupons/coupons.service.js';

// Private Helpers //

const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(6).toString('hex');
  const hash = crypto
    .createHash('sha256')
    .update(`${timestamp}${randomPart}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `ORD-${timestamp}-${hash}`;
};

const toCents = (val) => Math.round((parseFloat(val) || 0) * 100);

const prepareCustomerInfo = async (user) => {
  if (!user?.customer_id) return null;

  const customer = await findCustomerById(user.customer_id);
  if (!customer) return null;

  return {
    name: `${customer.first_name} ${customer.last_name}`.trim(),
    phone: customer.phone,
    email: customer.email,
  };
};

const resolveVerifiedAddress = async (user, data) => {
  if (user?.customer_id) {
    let address;
    if (data.address_id) {
      address = await addressService.findCustomerAddressById(
        data.address_id
      );
      if (!address) {
        throw AppError.notFound(
          'Address',
          'Selected address not found.'
        );
      }
      if (address.customer_id !== user.customer_id) {
        throw AppError.forbidden('Address ownership mismatch.');
      }
    } else {
      address = await addressService.findCustomerDefaultAddress(
        user.customer_id
      );
      if (!address) {
        throw AppError.badRequest(
          'No default address found for customer.'
        );
      }
    }
    return {
      street: address.street,
      city: address.city,
      state: address.province_code || '',
      postal_code: address.postal_code || '',
      country_code: address.country_code || 'US',
    };
  }

  if (!data.guest_address) {
    throw AppError.badRequest(
      'Guest shipping address info is required.'
    );
  }

  return {
    street: data.guest_address.street,
    city: data.guest_address.city,
    state: data.guest_address.province_code || '',
    postal_code: data.guest_address.postal_code || '',
    country_code: data.guest_address.country_code || 'US',
  };
};

const validateCancelPermission = (order, user, guestEmail) => {
  if (user) {
    if (order.customer_id !== user.id) {
      throw AppError.forbidden(
        'Access denied',
        'You do not have permission to cancel this order.'
      );
    }
    return;
  }

  const matchesGuest =
    order.guest_email &&
    guestEmail &&
    order.guest_email.toLowerCase() ===
      guestEmail.trim().toLowerCase();

  if (order.customer_id || !matchesGuest) {
    throw AppError.forbidden(
      'Access denied',
      'Invalid email or unauthorized access.'
    );
  }
};

const performOrderCancellation = async (order) => {
  if (order.status === 'CANCELLED') {
    return {
      success: true,
      message: 'Order is already cancelled.',
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
        },
      },
    };
  }

  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw AppError.badRequest(
      'Order cannot be cancelled',
      `Only PENDING or CONFIRMED orders can be cancelled. Current status: ${order.status}.`
    );
  }

  if (order.payment_status === 'PAID') {
    throw AppError.conflict(
      'This order has already been paid. Use the refund workflow instead of cancelling it.'
    );
  }

  const [shippingRecord, paymentRecord] = await Promise.all([
    shipmentService.findShipmentByOrderId(order.id),
    paymentService.findPaymentByOrderId(order.id),
  ]);

  // Expire an open Checkout Session before releasing its inventory reservation.
  // A completed/paid session blocks cancellation until its webhook is reconciled.
  if (order.payment_method === 'CARD' && paymentRecord?.checkout_session_id) {
    await stripeService.cancelStripeCheckoutSession(
      paymentRecord.checkout_session_id
    );
  } else if (
    order.payment_method === 'CARD' &&
    paymentRecord?.transaction_id?.startsWith('pi_')
  ) {
    await stripeService.cancelStripePaymentIntent(paymentRecord.transaction_id);
  }

  await executeTransaction(async (client) => {
    const cancellation = await client.orders.updateMany({
      where: {
        id: order.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        payment_status: { not: 'PAID' },
      },
      data: { status: 'CANCELLED', payment_status: 'CANCELLED' },
    });

    if (cancellation.count === 0) {
      throw AppError.conflict(
        'The order changed while cancellation was in progress. Refresh and try again.'
      );
    }

    // Checkout has only reserved inventory while an order is PENDING/CONFIRMED.
    // Releasing a reservation must not increase on-hand stock a second time.
    const orderItems = await OrderItemModel.findByOrderId(order.id, client);
    for (const item of orderItems) {
      await prodVariantService.releaseProductReservation(
        item.variant_id,
        item.quantity,
        client
      );
    }

    if (order.coupon_id) await decrementCouponUsage(order.coupon_id, client);

    await paymentService.updatePaymentRecordByOrder(
      order.id,
      { status: 'CANCELLED', checkout_url: null },
      client
    );

    if (shippingRecord) {
      await shipmentService.updateShippingRecord(
        shippingRecord.id,
        { status: 'CANCELLED' },
        client
      );
    }
  });

  const warnings = [];
  if (shippingRecord?.transaction_id) {
    try {
      await shippoService.cancelShippoShipment(shippingRecord.transaction_id);
    } catch (err) {
      console.error(`[Shippo Cancel Failed] Order ${order.id}:`, err.message);
      warnings.push('Shipment cancellation with carrier could not be completed.');
    }
  }

  const updatedOrder = await OrderModel.findById(order.id);
  return {
    success: true,
    message: 'Order cancelled successfully.',
    data: {
      order: {
        id: updatedOrder.id,
        order_number: updatedOrder.order_number,
        status: updatedOrder.status,
        payment_status: updatedOrder.payment_status,
      },
    },
    ...(warnings.length > 0 && { warnings }),
  };
};

const buildOrderResponsePayload = (order, scope = 'public') => {
  const isGuest = !order.customer_id;
  const isAdmin = scope === 'admin';

  return {
    id: order.id,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    subtotal: Number(order.subtotal),
    discount_amount: Number(order.discount_amount),
    shipping_cost: Number(order.shipping_cost),
    total_amount: Number(order.total_amount),
    placed_at: order.placed_at,
    items_count: order.items?.length || 0,
    ...(isGuest
      ? {
          customer: {
            name: order.guest_name,
            email: order.guest_email,
            phone: order.guest_phone,
            address: order.guest_address,
          },
        }
      : {
          customer: {
            id: order.customer.id,
            name: `${order.customer.first_name} ${order.customer.last_name}`,
            email: order.customer.email,
            phone: order.customer.phone,
            is_active: order.customer.is_active,
            created_at: order.customer.created_at,
            deleted_at: order.customer.deleted_at,
          },
        }),
    items: (order.items || []).map((item) => ({
      id: item.id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
      ...(isAdmin && { variant_options: item.variant_options }),
    })),
    shipments: (order.shipments || []).map((ship) => ({
      id: ship.id,
      status: ship.status,
      carrier: ship.carrier,
      tracking_number: ship.tracking_number,
      delivered_at: ship.delivered_at,
      shipped_at: ship.shipped_at,
      ...(isAdmin && {
        transaction_id: ship.transaction_id,
        label_url: ship.label_url,
      }),
    })),
    payments: (order.payments || []).map((pay) => ({
      id: pay.id,
      status: pay.status,
      method: pay.method,
      amount: Number(pay.amount),
      paid_at: pay.paid_at,
      ...(isAdmin && { transaction_id: pay.transaction_id }),
    })),
  };
};

// Main Services //

/**
 * Processes checkout context, reserves inventory atomically, creates order records,
 * creates initial shipment audit trails, and initializes payment intents.
 */
export const createOrderService = async (user, data) => {
  const verifiedAddress = await resolveVerifiedAddress(user, data);
  const customerInfo = await prepareCustomerInfo(user);
  const isRegistered = Boolean(user?.customer_id);
  const checkoutContext = {
    address: verifiedAddress,
    customer: customerInfo || {
      name: data.guest_name,
      phone: data.guest_phone,
      email: data.guest_email,
    },
  };

  // A shipping quote is an external network call and must not hold a DB
  // transaction open. The cart is revalidated inside the write transaction.
  const cartData = await cartService.resolveCartForCheckout(user, checkoutContext);
  const shippingInfo = await shippoService.fetchRatesAndLowestRate({
    ...checkoutContext,
    totalWeight: cartData.totalWeight || 1,
  });

  const subtotalCents = toCents(cartData.subtotal);
  const discountCents = toCents(cartData.discount);
  const shippingFeeCents = toCents(shippingInfo.fee);
  const totalAmountCents = subtotalCents - discountCents + shippingFeeCents;
  if (totalAmountCents < 0) {
    throw AppError.badRequest('Invalid total amount calculation.');
  }

  const subtotal = subtotalCents / 100;
  const discountAmount = discountCents / 100;
  const shippingCost = shippingFeeCents / 100;
  const totalAmount = totalAmountCents / 100;
  let initialShipment = null;

  const { order } = await executeTransaction(async (client) => {
    const currentCart = await cartService.resolveCartForCheckout(
      user,
      checkoutContext,
      client
    );
    const snapshotChanged =
      currentCart.items.length !== cartData.items.length ||
      currentCart.items.some((item, index) => {
        const original = cartData.items[index];
        return !original || item.id !== original.id ||
          item.variant_id !== original.variant_id ||
          item.quantity !== original.quantity ||
          toCents(item.variant.price) !== toCents(original.variant.price);
      }) ||
      toCents(currentCart.subtotal) !== subtotalCents ||
      toCents(currentCart.discount) !== discountCents ||
      Number(currentCart.totalWeight) !== Number(cartData.totalWeight);

    if (snapshotChanged) {
      throw AppError.conflict(
        'Your cart or pricing changed during checkout. Review your cart and place the order again.'
      );
    }

    if (currentCart.cart?.coupon_id) {
      const coupon = await findCouponById(currentCart.cart.coupon_id, client);
      if (!coupon) throw AppError.badRequest('The applied coupon is no longer available.');
      const validatedCoupon = await validateAndCalculateDiscount(
        coupon.code,
        subtotal,
        client
      );
      if (toCents(validatedCoupon.discountAmount) !== discountCents) {
        throw AppError.conflict(
          'Your discount changed during checkout. Refresh the cart before placing the order.'
        );
      }
      await incrementCouponUsage(coupon.id, client);
    }

    const orderPayload = {
      order_number: generateOrderNumber(),
      customer_id: isRegistered ? user.customer_id : null,
      address_id: isRegistered ? data.address_id : null,
      guest_name: isRegistered ? null : data.guest_name,
      guest_email: isRegistered ? null : data.guest_email,
      guest_phone: isRegistered ? null : data.guest_phone,
      guest_address: isRegistered ? null : data.guest_address,
      coupon_id: currentCart.cart?.coupon_id || null,
      status: 'PENDING',
      payment_method: data.payment_method,
      payment_status: 'UNPAID',
      subtotal,
      discount_amount: discountAmount,
      shipping_cost: shippingCost,
      total_amount: totalAmount,
    };

    const newOrder = await OrderModel.create(orderPayload, client);
    const orderItemPayloads = currentCart.items.map((item) => ({
      order_id: newOrder.id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      sku: item.variant.sku,
      variant_options: item.variant.attributes,
      quantity: item.quantity,
      unit_price: item.variant.price,
      total_price: (toCents(item.variant.price) * item.quantity) / 100,
    }));
    await OrderItemModel.insertMany(orderItemPayloads, client);

    for (const item of currentCart.items) {
      const reserved = await prodVariantService.atomicReserveStockOperation(
        item.variant_id,
        item.quantity,
        client
      );
      if (!reserved) {
        throw AppError.badRequest(
          `Insufficient stock for '${item.product_name || item.variant.sku}'.`
        );
      }
    }

    initialShipment = await shipmentService.createShipmentRecord(
      {
        order_id: newOrder.id,
        carrier: shippingInfo.carrier,
        rate_id: shippingInfo.rateObjectId || null,
        transaction_id: null,
        tracking_number: null,
        label_url: null,
        status: shippingInfo.mock ? 'PROCESSING' : 'PENDING_LABEL',
      },
      client
    );

    return { order: newOrder };
  });

  let paymentIntent = null;
  if (data.payment_method === 'CARD') {
    try {
      paymentIntent = await stripeService.processOrderPaymentIntent(order.id);
    } catch (error) {
      // Compensate for a failed Stripe-session initialization. Leave the cart
      // untouched and release the stock/coupon reservation so retrying checkout
      // does not create orphaned inventory holds.
      try {
        const latestOrder = await OrderModel.findById(order.id);
        if (latestOrder && ['PENDING', 'CONFIRMED'].includes(latestOrder.status)) {
          await performOrderCancellation(latestOrder);
        }
      } catch (compensationError) {
        console.error(
          `[CHECKOUT COMPENSATION ERROR] Order ${order.id}:`,
          compensationError
        );
      }
      throw error;
    }
  } else if (!shippingInfo.mock && shippingInfo.rateObjectId) {
    // COD orders may be prepared for dispatch immediately; card orders are not
    // sent to the carrier until Stripe confirms payment in the webhook.
    fireBackgroundTask(async () => {
      try {
        await shipmentService.purchaseAndPersistShipmentLabel(order.id);
      } catch (err) {
        console.error(`[SHIPPO LABEL ERROR] Order ${order.id}:`, err);
      }
    });
  }

  await cartService.clearCart(user);

  return {
    success: true,
    message: data.payment_method === 'CARD'
      ? 'Order created. Redirecting to secure payment.'
      : 'Order placed successfully.',
    data: {
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_method: data.payment_method,
        total_amount: order.total_amount,
      },
      payment: paymentIntent
        ? { checkoutUrl: paymentIntent.checkoutUrl, sessionId: paymentIntent.sessionId }
        : null,
      summary: {
        subtotal,
        discount: discountAmount,
        shipping: shippingCost,
        total: totalAmount,
      },
    },
  };
};

export const cancelOrderService = async ({
  orderId,
  user,
  guestEmail,
}) => {
  const order = await OrderModel.findById(orderId);
  if (!order) {
    throw AppError.notFound(
      'Order',
      `Order with ID ${orderId} not found.`
    );
  }

  validateCancelPermission(order, user, guestEmail);
  return performOrderCancellation(order);
};

export const getCustomerOrdersService = async (customerId, query) => {
  const limit = Math.min(Math.max(Number(query.limit) || 15, 1), 100);
  const { cursor, status } = query;

  const where = {
    customer_id: customerId,
    ...(status && { status: status.toUpperCase() }),
  };

  const orders = await OrderModel.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { placed_at: 'desc' },
    include: {
      items: {
        select: { id: true },
      },
    },
  });

  const hasNextPage = orders.length > limit;
  const results = hasNextPage ? orders.slice(0, limit) : orders;
  const nextCursor = hasNextPage
    ? results[results.length - 1].id
    : null;

  return {
    success: true,
    message: 'Data retrieved successfully',
    data: {
      orders: results.map((order) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        total_amount: Number(order.total_amount),
        placed_at: order.placed_at,
        items_count: order.items.length,
      })),
      pagination: {
        next_cursor: nextCursor,
        limit,
        has_next: hasNextPage,
      },
    },
  };
};

export const getCustomerOrderService = async (orderId, user) => {
  const order = await OrderModel.findWithDetails({ id: orderId });
  if (!order) {
    throw AppError.notFound(
      'Order',
      `Order with ID ${orderId} not found.`
    );
  }

  if (user.id !== order.customer_id) {
    throw AppError.forbidden(
      'Order access denied.',
      'You do not have permission to view this order.'
    );
  }

  return {
    success: true,
    message: 'Data retrieved successfully',
    order: buildOrderResponsePayload(order, 'public'),
  };
};

export const lookupOrderService = async (user, query) => {
  if (user !== null) {
    throw AppError.forbidden(
      'Authenticated user are not allowed',
      'Authenticated users should use order history endpoints.'
    );
  }

  const order = await OrderModel.findWithDetails({
    order_number: query.order_number,
  });

  if (!order) {
    throw AppError.notFound(
      'Order',
      `Order with number ${query.order_number} not found.`
    );
  }

  if (
    !order.guest_email ||
    query.email?.toLowerCase() !== order.guest_email.toLowerCase()
  ) {
    throw AppError.forbidden(
      'Order access denied',
      'You do not have permission to view this order.'
    );
  }

  return {
    success: true,
    message: 'Data retrieved successfully',
    order: buildOrderResponsePayload(order, 'public'),
  };
};

export const getAllOrdersService = async (query) => {
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const sortOrder =
    query.sort?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  const {
    cursor,
    status,
    payment_status,
    payment_method,
    search,
    customer_id,
    from_date,
    to_date,
    min_amount,
    max_amount,
  } = query;

  if (customer_id) {
    const customer = await findCustomerById(customer_id);
    if (!customer) {
      throw AppError.notFound(
        'Customer',
        `Customer with ID ${customer_id} not found`
      );
    }
  }

  const where = {};

  if (status) where.status = status.toUpperCase();
  if (payment_status)
    where.payment_status = payment_status.toUpperCase();
  if (payment_method)
    where.payment_method = payment_method.toUpperCase();
  if (customer_id) where.customer_id = customer_id;

  if (search?.trim()) {
    const term = search.trim();
    where.OR = [
      { order_number: { contains: term, mode: 'insensitive' } },
      { guest_name: { contains: term, mode: 'insensitive' } },
      { guest_email: { contains: term, mode: 'insensitive' } },
      {
        customer: {
          first_name: { contains: term, mode: 'insensitive' },
        },
      },
      {
        customer: {
          last_name: { contains: term, mode: 'insensitive' },
        },
      },
      {
        items: {
          some: {
            OR: [
              {
                product_name: { contains: term, mode: 'insensitive' },
              },
              { sku: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
      },
      {
        shipments: {
          some: {
            tracking_number: { contains: term, mode: 'insensitive' },
          },
        },
      },
    ];
  }

  if (min_amount !== undefined || max_amount !== undefined) {
    where.total_amount = {};
    if (min_amount !== undefined)
      where.total_amount.gte = Number(min_amount);
    if (max_amount !== undefined)
      where.total_amount.lte = Number(max_amount);
  }

  if (from_date || to_date) {
    where.placed_at = {};
    if (from_date) where.placed_at.gte = new Date(from_date);
    if (to_date) where.placed_at.lte = new Date(to_date);
  }

  const orders = await OrderModel.findMany({
    where,
    orderBy: { placed_at: sortOrder },
    cursor: cursor ? { id: cursor } : undefined,
    take: limit + 1,
    include: {
      items: { select: { id: true } },
    },
  });

  const hasNextPage = orders.length > limit;
  const results = hasNextPage ? orders.slice(0, limit) : orders;
  const nextCursor = hasNextPage
    ? results[results.length - 1].id
    : null;

  return {
    success: true,
    message: 'Orders retrieved successfully.',
    data: {
      orders: results.map((order) => ({
        id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        status: order.status,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        subtotal: Number(order.subtotal),
        discount_amount: Number(order.discount_amount),
        shipping_cost: Number(order.shipping_cost),
        total_amount: Number(order.total_amount),
        placed_at: order.placed_at,
        items_count: order.items.length,
        customer_type: order.customer_id ? 'REGISTERED' : 'GUEST',
        guest_details: order.customer_id
          ? null
          : { name: order.guest_name, email: order.guest_email },
      })),
      pagination: {
        next_cursor: nextCursor,
        limit,
        has_next: hasNextPage,
      },
    },
  };
};

export const getOrderForAdminService = async (orderId) => {
  const order = await OrderModel.findWithDetails({ id: orderId });
  if (!order) {
    throw AppError.notFound(
      'Order',
      `Order with ID ${orderId} not found.`
    );
  }

  return {
    success: true,
    message: 'Data retrieved successfully',
    order: buildOrderResponsePayload(order, 'admin'),
  };
};

export const updateOrderStatusService = async (orderId, body) => {
  if (body.status === 'CANCELLED') {
    return cancelOrderAdminService({ orderId });
  }

  return await executeTransaction(async (client) => {
    const order = await OrderModel.findById(orderId, client);
    if (!order) {
      throw AppError.notFound(
        'Order',
        `Order with ID ${orderId} not found.`
      );
    }

    if (order.status === body.status) {
      return {
        success: true,
        message: 'Order updated successfully',
        order: { id: order.id, status: order.status },
      };
    }

    const allowedTransitions = {
      PENDING: ['CONFIRMED', 'PROCESSING', 'SHIPPED'],
      CONFIRMED: ['PROCESSING', 'SHIPPED'],
      PROCESSING: ['SHIPPED', 'DELIVERED'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (!allowedTransitions[order.status]?.includes(body.status)) {
      throw AppError.conflict(
        `Invalid order status transition: ${order.status} to ${body.status}.`
      );
    }

    // Card orders may not be advanced to CONFIRMED or fulfilment while unpaid;
    // doing so would block secure payment retry and could ship unpaid goods.
    if (order.payment_method === 'CARD' && order.payment_status !== 'PAID') {
      throw AppError.badRequest(
        'A card order cannot advance until Stripe confirms payment. The customer can retry payment while the order is pending.'
      );
    }

    const fulfillmentStatuses = ['PROCESSING', 'SHIPPED', 'DELIVERED'];
    const isStartingFulfillment =
      ['PENDING', 'CONFIRMED'].includes(order.status) &&
      fulfillmentStatuses.includes(body.status);

    if (isStartingFulfillment) {
      // Both COD and paid-card orders held reservations at checkout. Commit a
      // reservation only when transitioning an order out of its initial states.
      const items = await OrderItemModel.findByOrderId(orderId, client);
      for (const item of items) {
        await prodVariantService.decreaseProductStockAndReverved(
          item.variant_id,
          item.quantity,
          client
        );
      }
    }

    const updatedOrder = await OrderModel.update(
      orderId,
      { status: body.status },
      client
    );

    return {
      success: true,
      message: 'Order updated successfully',
      order: { id: updatedOrder.id, status: updatedOrder.status },
    };
  });
};

export const updateOrderPaymentStatusService = async (
  orderId,
  body
) => {
  return await executeTransaction(async (client) => {
    const order = await OrderModel.findById(orderId, client);
    if (!order) {
      throw AppError.notFound(
        'Order',
        `Order with ID ${orderId} not found.`
      );
    }

    if (order.payment_method === 'CARD') {
      if (body.status === order.payment_status) {
        return {
          success: true,
          message: 'Payment status is already current.',
          data: { id: orderId, status: order.payment_status },
        };
      }
      throw AppError.badRequest(
        'Card payment status is controlled by Stripe. Use the Stripe refund workflow for refunds and the order cancellation workflow for cancellations.'
      );
    }

    if (['REFUNDED', 'CANCELLED'].includes(body.status)) {
      throw AppError.badRequest(
        'Refund and cancellation payment statuses are applied by their corresponding order workflows.'
      );
    }
    if (order.status === 'CANCELLED' && body.status !== 'CANCELLED') {
      throw AppError.conflict('A cancelled order payment status cannot be reopened manually.');
    }

    await paymentService.upsertPaymentRecordForOrder(
      orderId,
      {
        method: order.payment_method,
        status: body.status,
        amount: order.total_amount,
        paid_at: body.status === 'PAID' ? new Date() : null,
      },
      client
    );

    await OrderModel.update(orderId, { payment_status: body.status }, client);

    const updatedPayment = await paymentService.findPaymentByOrderId(orderId, client);
    return {
      success: true,
      message: 'Order payment updated successfully',
      data: { id: orderId, status: updatedPayment?.status ?? body.status },
    };
  });
};

export const updateOrderShippingStatusService = async (
  orderId,
  body
) => {
  return await executeTransaction(async (client) => {
    const order = await OrderModel.findById(orderId, client);
    if (!order) {
      throw AppError.notFound(
        'Order',
        `Order with ID ${orderId} not found.`
      );
    }

    const shipment = await shipmentService.findShipmentByOrderId(orderId, client);
    if (!shipment) throw AppError.notFound('Shipment', 'No shipment exists for this order.');
    if (shipment.status === body.status) {
      return {
        success: true,
        message: 'Shipment status is already current.',
        data: { id: orderId, status: shipment.status },
      };
    }

    const allowedShipmentTransitions = {
      PENDING_LABEL: [],
      PROCESSING: ['SHIPPED'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (!allowedShipmentTransitions[shipment.status]?.includes(body.status)) {
      throw AppError.conflict(
        `Invalid shipment status transition: ${shipment.status} to ${body.status}. Wait for label creation or use the correct fulfilment workflow.`
      );
    }

    const shipmentUpdates = { status: body.status };
    if (body.status === 'SHIPPED') {
      if (order.payment_method === 'CARD' && order.payment_status !== 'PAID') {
        throw AppError.badRequest('An unpaid card order cannot be shipped.');
      }
      if (!['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(order.status)) {
        throw AppError.conflict(`Order status ${order.status} is not eligible to ship.`);
      }
      if (['PENDING', 'CONFIRMED'].includes(order.status)) {
        const items = await OrderItemModel.findByOrderId(orderId, client);
        for (const item of items) {
          await prodVariantService.decreaseProductStockAndReverved(
            item.variant_id,
            item.quantity,
            client
          );
        }
      }
      shipmentUpdates.shipped_at = new Date();
      await OrderModel.update(orderId, { status: 'SHIPPED' }, client);
    } else if (body.status === 'DELIVERED') {
      if (order.status !== 'SHIPPED') {
        throw AppError.conflict('An order must be marked shipped before it can be delivered.');
      }
      shipmentUpdates.delivered_at = new Date();
      await OrderModel.update(orderId, { status: 'DELIVERED' }, client);
    }

    const updatedRecord = await shipmentService.updateShippingRecord(
      shipment.id,
      shipmentUpdates,
      client
    );

    return {
      success: true,
      message: 'Order shipping updated successfully',
      data: { id: orderId, status: updatedRecord.status },
    };
  });
};

export const cancelOrderAdminService = async ({ orderId }) => {
  const order = await OrderModel.findById(orderId);
  if (!order) {
    throw AppError.notFound(
      'Order',
      `Order with ID ${orderId} not found.`
    );
  }
  return performOrderCancellation(order);
};

/** Full Stripe refund workflow. Unshipped orders are cancelled and inventory is
 * reconciled atomically; shipped/delivered orders retain their fulfilment state. */
export const refundOrderPaymentService = async (orderId) => {
  const order = await OrderModel.findById(orderId);
  if (!order) {
    throw AppError.notFound('Order', `Order with ID ${orderId} not found.`);
  }
  if (order.payment_method !== 'CARD') {
    throw AppError.badRequest('Only card payments can be refunded through Stripe.');
  }

  let payment = await paymentService.findPaymentByOrderId(orderId);
  if (!payment?.transaction_id?.startsWith('pi_')) {
    throw AppError.conflict('No Stripe PaymentIntent is linked to this order.');
  }

  if (order.payment_status === 'REFUNDED' && payment.status === 'REFUNDED') {
    return {
      success: true,
      message: 'Payment has already been refunded.',
      data: { orderId, payment_status: 'REFUNDED', order_status: order.status },
    };
  }

  // If Stripe succeeded but a prior request failed while reconciling the order,
  // the persisted payment state lets this request safely finish without refunding twice.
  if (payment.status !== 'REFUNDED') {
    if (order.payment_status !== 'PAID' || payment.status !== 'PAID') {
      throw AppError.conflict('Only a confirmed, paid Stripe order can be refunded.');
    }
    await stripeService.refundStripePayment(
      payment.transaction_id,
      Number(order.total_amount),
      `admin-order-refund-${orderId}-${payment.transaction_id}`
    );
  }

  const originalShipment = await shipmentService.findShipmentByOrderId(orderId);
  let cancelledBeforeShipment = false;
  const result = await executeTransaction(async (client) => {
    const latestOrder = await OrderModel.findById(orderId, client);
    const latestPayment = await paymentService.findPaymentByOrderId(orderId, client);
    if (!latestOrder || !latestPayment) {
      throw AppError.conflict('Order/payment state changed during refund reconciliation.');
    }
    if (latestOrder.payment_status === 'REFUNDED') {
      return { status: latestOrder.status, payment_status: 'REFUNDED' };
    }
    if (latestPayment.status !== 'REFUNDED') {
      throw AppError.conflict('Stripe refund has not been persisted; refresh and retry reconciliation.');
    }

    const initialStates = ['PENDING', 'CONFIRMED'];
    const shouldCancel = [...initialStates, 'PROCESSING'].includes(latestOrder.status);
    if (shouldCancel) {
      const transition = await client.orders.updateMany({
        where: {
          id: orderId,
          status: latestOrder.status,
          payment_status: { in: ['PAID', 'UNPAID', 'CANCELLED'] },
        },
        data: { status: 'CANCELLED', payment_status: 'REFUNDED' },
      });
      if (transition.count !== 1) {
        throw AppError.conflict('Order changed during refund reconciliation. Refresh and try again.');
      }

      const items = await OrderItemModel.findByOrderId(orderId, client);
      for (const item of items) {
        if (initialStates.includes(latestOrder.status)) {
          await prodVariantService.releaseProductReservation(
            item.variant_id,
            item.quantity,
            client
          );
        } else {
          // PROCESSING means the reservation was committed when Stripe payment
          // was accepted, so undo that stock decrement exactly once.
          await prodVariantService.restoreProductStock(
            item.variant_id,
            item.quantity,
            client
          );
        }
      }

      if (latestOrder.coupon_id) await decrementCouponUsage(latestOrder.coupon_id, client);
      await shipmentService.updateShippingByOrderId(
        orderId,
        { status: 'CANCELLED' },
        client
      );
      cancelledBeforeShipment = true;
    } else {
      await client.orders.update({
        where: { id: orderId },
        data: { payment_status: 'REFUNDED' },
      });
    }

    return { status: shouldCancel ? 'CANCELLED' : latestOrder.status, payment_status: 'REFUNDED' };
  });

  const warnings = [];
  if (cancelledBeforeShipment && originalShipment?.transaction_id) {
    try {
      await shippoService.cancelShippoShipment(originalShipment.transaction_id);
    } catch (error) {
      console.error(`[SHIPPO REFUND CANCEL ERROR] Order ${orderId}:`, error.message);
      warnings.push('Payment was refunded, but the shipping label could not be cancelled automatically.');
    }
  }

  return {
    success: true,
    message: 'Stripe payment refunded successfully.',
    data: { orderId, payment_status: result.payment_status, order_status: result.status },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

export const createOrderPaymentSessionService = async (orderId, user, payload = {}) => {
  const order = await OrderModel.findById(orderId);
  if (!order) throw AppError.notFound('Order', `Order with ID ${orderId} not found.`);

  if (order.customer_id) {
    if (!user?.id || order.customer_id !== user.id) {
      throw AppError.forbidden('You do not have permission to pay this order.');
    }
  } else {
    const emailMatches = order.guest_email && payload.email &&
      order.guest_email.toLowerCase() === payload.email.trim().toLowerCase();
    const numberMatches = order.order_number && payload.order_number &&
      order.order_number.toUpperCase() === payload.order_number.trim().toUpperCase();
    if (!emailMatches || !numberMatches) {
      throw AppError.forbidden('Enter the email address and order number used for this guest order.');
    }
  }

  if (order.status !== 'PENDING' || order.payment_status === 'PAID') {
    throw AppError.badRequest('This order is not eligible for payment retry.');
  }
  if (order.payment_method !== 'CARD') {
    throw AppError.badRequest('Only card orders can be paid through Stripe.');
  }

  const payment = await stripeService.processOrderPaymentIntent(orderId);
  return {
    success: true,
    message: 'Secure payment session ready.',
    data: { payment },
  };
};

// Shared Model Utility Wrappers //

export const findOrderById = async (orderId, client) =>
  OrderModel.findById(orderId, client);
export const updateOrderStatus = async (orderId, payload, client) =>
  OrderModel.update(orderId, payload, client);
export const findItemsByOrderId = async (orderId, client) =>
  OrderItemModel.findByOrderId(orderId, client);
export const findPaymentByOrderId = async (orderId, client) =>
  paymentService.findPaymentByOrderId(orderId, client);
