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

  const [shippingRecord, paymentRecord] = await Promise.all([
    shipmentService.findShipmentByOrderId(order.id),
    paymentService.findPaymentByOrderId(order.id),
  ]);

  await executeTransaction(async (client) => {
    const orderItems = await OrderItemModel.findByOrderId(
      order.id,
      client
    );

    for (const item of orderItems) {
      await prodVariantService.restoreProductStock(
        item.variant_id,
        item.quantity,
        client
      );
    }

    await updateOrderStatus(
      order.id,
      { status: 'CANCELLED' },
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

  if (
    paymentRecord?.transaction_id &&
    order.payment_method === 'CARD'
  ) {
    try {
      if (['PAID', 'SUCCEEDED'].includes(order.payment_status)) {
        await stripeService.refundStripePayment(
          paymentRecord.transaction_id,
          order.total_amount
        );
      } else {
        await stripeService.cancelStripePaymentIntent(
          paymentRecord.transaction_id
        );
      }
    } catch (err) {
      console.error(
        `[Refund Failed] Order ${order.id}:`,
        err.message
      );
      warnings.push('Payment could not be refunded automatically.');
    }
  }

  if (shippingRecord?.transaction_id) {
    try {
      await shippoService.cancelShippoShipment(
        shippingRecord.transaction_id
      );
    } catch (err) {
      console.error(
        `[Shippo Cancel Failed] Order ${order.id}:`,
        err.message
      );
      warnings.push(
        'Shipment cancellation with carrier could not be completed.'
      );
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
      : { customer_id: order.customer_id }),
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
  // Resolve address and customer details prior to starting database locks
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

  // Retrieve active cart items and calculate real-time shipping rates
  const cartData = await cartService.resolveCartForCheckout(
    user,
    checkoutContext
  );

  const shippingInfo = await shippoService.fetchRatesAndLowestRate({
    ...checkoutContext,
    totalWeight: cartData.totalWeight || 1,
  });

  // Calculate financials in integer cents to eliminate rounding precision issues
  const subtotalCents = toCents(cartData.subtotal);
  const discountCents = toCents(cartData.discount);
  const shippingFeeCents = toCents(shippingInfo.fee);

  const totalAmountCents =
    subtotalCents - discountCents + shippingFeeCents;

  if (totalAmountCents < 0) {
    throw AppError.badRequest('Invalid total amount calculation.');
  }

  // Convert normalized cent values back to standard unit decimal values for database storage
  const subtotal = subtotalCents / 100;
  const discountAmount = discountCents / 100;
  const shippingCost = shippingFeeCents / 100;
  const totalAmount = totalAmountCents / 100;

  let initialShipment = null;

  // Execute database writes inside an isolated atomic transaction
  const { order } = await executeTransaction(async (client) => {
    const orderPayload = {
      order_number: generateOrderNumber(),
      customer_id: isRegistered ? user.customer_id : null,
      address_id: isRegistered ? data.address_id : null,
      guest_name: isRegistered ? null : data.guest_name,
      guest_email: isRegistered ? null : data.guest_email,
      guest_phone: isRegistered ? null : data.guest_phone,
      guest_address: isRegistered ? null : data.guest_address,
      coupon_id: cartData.cart?.coupon_id || null,
      status: 'PENDING',
      payment_method: data.payment_method,
      payment_status: 'UNPAID',
      subtotal,
      discount_amount: discountAmount,
      shipping_cost: shippingCost,
      total_amount: totalAmount,
    };

    const newOrder = await OrderModel.create(orderPayload, client);

    const orderItemPayloads = cartData.items.map((item) => ({
      order_id: newOrder.id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      sku: item.variant.sku,
      variant_options: item.variant.attributes,
      quantity: item.quantity,
      unit_price: item.variant.price,
      total_price:
        (toCents(item.variant.price) * item.quantity) / 100,
    }));

    await OrderItemModel.insertMany(orderItemPayloads, client);

    // Reserve stock atomically at the database engine level to prevent over-selling
    for (const item of cartData.items) {
      const reserved =
        await prodVariantService.atomicReserveStockOperation(
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

    // Persist an initial shipment record with PENDING_LABEL status for recovery tracking
    initialShipment = await shipmentService.createShipmentRecord(
      {
        order_id: newOrder.id,
        carrier: shippingInfo.carrier,
        transaction_id: null,
        tracking_number: null,
        label_url: null,
        status: 'PENDING_LABEL',
      },
      client
    );

    return { order: newOrder };
  });

  // Attempt asynchronous shipping label purchase; failures remain recoverable via cron job
  fireBackgroundTask(async () => {
    try {
      const labelDetails = await shippoService.purchaseLabelAsync(
        shippingInfo.rateObjectId
      );

      await shipmentService.updateShippingRecord(initialShipment.id, {
        transaction_id: labelDetails.transactionId,
        tracking_number: labelDetails.trackingNumber,
        label_url: labelDetails.labelUrl,
        status: 'PROCESSING',
      });
    } catch (err) {
      console.error(`[SHIPPO LABEL ERROR] Order ${order.id}:`, err);
    }
  });

  // Initialize payment gateway intent if credit card is selected
  let paymentIntent = null;
  if (data.payment_method === 'CARD') {
    paymentIntent = await stripeService.processOrderPaymentIntent(
      order.id
    );
  }

  // Clear customer or session cart following successful order creation
  await cartService.clearCart(user);

  return {
    success: true,
    message:
      data.payment_method === 'CARD'
        ? 'Order created. Complete payment using the provided intent.'
        : 'Order placed successfully.',
    data: {
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_amount: order.total_amount,
      },
      paymentIntent: paymentIntent
        ? { clientSecret: paymentIntent.clientSecret }
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

    await paymentService.updatePaymentRecordByOrder(
      orderId,
      { status: body.status },
      client
    );
    await OrderModel.update(
      orderId,
      { payment_status: body.status },
      client
    );

    const updatedPayment = await paymentService.findPaymentByOrderId(
      orderId,
      client
    );

    return {
      success: true,
      message: 'Order payment updated successfully',
      data: { id: orderId, status: updatedPayment.status },
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

    await shipmentService.updateShippingByOrderId(
      orderId,
      { status: body.status },
      client
    );
    const updatedRecord = await shipmentService.findShipmentByOrderId(
      orderId,
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

// Shared Model Utility Wrappers //

export const findOrderById = async (orderId, client) =>
  OrderModel.findById(orderId, client);
export const updateOrderStatus = async (orderId, payload, client) =>
  OrderModel.update(orderId, payload, client);
export const findItemsByOrderId = async (orderId, client) =>
  OrderItemModel.findByOrderId(orderId, client);
