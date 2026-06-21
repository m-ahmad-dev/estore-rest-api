import crypto from 'crypto';
import AppError from '../../core/utils/error.utils.js';
import executeTransaction from '../../core/utils/dbTransaction.js';
import * as cartService from '../cart/cart.service.js';
import * as addressService from '../address/address.service.js';
import * as shipmentService from '../shipments/shipments.service.js';
import * as prodVariantService from '../products/variants/variants.service.js';
import * as shippoService from '../shipments/shippo.service.js';
import * as stripeService from '../payment/stripe.service.js';
import { fireBackgroundTask } from '../../core/utils/async_worker.utils.js';
import { findCustomerById } from '../customer/customer.service.js';
import { OrderModel, OrderItemModel } from './order.model.js';
import { findPaymentByOrderId } from '../payment/payment.service.js';

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

const prepareCustomerInfo = async (user) => {
  if (!user.customer_id) {
    return null;
  }
  const customer = await findCustomerById(user.customer_id);
  return {
    name: `${customer.first_name} ${customer.last_name}`,
    phone: customer.phone,
    email: customer.email,
  };
};

const resolveVerifiedAddress = async (user, data) => {
  if (user.customer_id) {
    let address;
    if (data.address_id) {
      address = await addressService.findCustomerAddressById(
        data.address_id
      );
      if (!address)
        throw AppError.notFound(
          'Address',
          'Selected address not found.'
        );
      if (address.customer_id !== user.customer_id) {
        throw AppError.forbidden('Address ownership mismatch.');
      }
    } else {
      address = await addressService.findCustomerDefaultAddress(
        user.customer_id
      );
      if (!address)
        throw AppError.badRequest(
          'No default address found for customer.'
        );
    }
    return {
      street: address.street,
      city: address.city,
      state: address.province_code || '',
      postal_code: address.postal_code || '',
      country_code: address.country_code || 'US',
    };
  }
  return {
    street: data.guest_address.street,
    city: data.guest_address.city,
    state: data.guest_address.province_code,
    postal_code: data.guest_address.postal_code,
    country_code: data.guest_address.country_code,
  };
};

// Main Services //
export const createOrderService = async (user, data) => {
  const verifiedAddress = await resolveVerifiedAddress(user, data);
  const customerInfo = await prepareCustomerInfo(user);

  const checkoutContext = {
    address: verifiedAddress,
    customer: customerInfo || {
      name: data.guest_name,
      phone: data.guest_phone,
      email: data.guest_email,
    },
  };

  // 1. Resolve Cart Context (Ab yeh zero network call leta hai, super fast)
  const cartData = await cartService.resolveCartForCheckout(
    user,
    checkoutContext
  );

  // 2. Fetch Live Rates (Sirf cost calculations ke liye - Takes ~1 sec max)
  const shippingInfo = await shippoService.fetchRatesAndLowestRate({
    ...checkoutContext,
    totalWeight: cartData.totalWeight || 1,
  });

  const calculatedTotal =
    parseFloat(cartData.subtotal) -
    parseFloat(cartData.discount) +
    shippingInfo.fee;

  // 3. Database Transaction Phase
  const { order } = await executeTransaction(async (client) => {
    const orderPayload = {
      order_number: generateOrderNumber(),
      customer_id: user.customer_id || null,
      address_id: user.customer_id ? data.address_id : null,
      guest_name: user.customer_id ? null : data.guest_name,
      guest_email: user.customer_id ? null : data.guest_email,
      guest_phone: user.customer_id ? null : data.guest_phone,
      guest_address: user.customer_id ? null : data.guest_address,
      coupon_id: cartData.cart.coupon_id || null,
      status: 'PENDING',
      payment_method: data.payment_method,
      payment_status:
        data.payment_method === 'CARD' ? 'UNPAID' : 'PAID',
      subtotal: cartData.subtotal,
      discount_amount: cartData.discount,
      shipping_cost: shippingInfo.fee,
      total_amount: calculatedTotal,
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
      total_price: item.quantity * item.variant.price,
    }));

    await OrderItemModel.insertMany(orderItemPayloads, client);

    for (const item of cartData.items) {
      await prodVariantService.updateVariantStockService(
        item.variant.product_id,
        item.variant_id,
        { quantity: item.quantity, operation: 'stock.reserve' },
        client
      );
    }

    // Default processing state shipment insert karein
    await shipmentService.createShipmentRecord(
      {
        order_id: newOrder.id,
        carrier: shippingInfo.carrier,
        transaction_id: null,
        tracking_number: null,
        label_url: null,
        status: 'PROCESSING',
      },
      client
    );

    return { order: newOrder };
  });

  // 4. 🚀 TRULY ASYNC BACKGROUND WORKER (No Await - Fire & Forget)
  fireBackgroundTask(async () => {
    console.log(
      `[BACKGROUND TASK STARTED] Initiating Shippo purchase loop for Order: ${order.id}`
    );

    const labelDetails = await shippoService.purchaseLabelAsync(
      shippingInfo.rateObjectId
    );
    const currentShipment =
      await shipmentService.findShipmentByOrderId(order.id);

    if (currentShipment) {
      await shipmentService.updateShippingRecord(currentShipment.id, {
        transaction_id: labelDetails.transactionId,
        tracking_number: labelDetails.trackingNumber,
        label_url: labelDetails.labelUrl,
        status: 'PROCESSING',
      });
      console.log(
        `[BACKGROUND TASK SUCCESS] Shipment updated with tracking details for Order: ${order.id}`
      );
    }
  });

  // 5. Post-checkout operations (Stripe Intent generation + Empty Cart)
  let paymentIntent = null;
  if (data.payment_method === 'CARD') {
    paymentIntent = await stripeService.processOrderPaymentIntent(
      order.id
    );
  }

  await cartService.clearCart(user);

  // Return Response instantly to Postman
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
        subtotal: cartData.subtotal,
        discount: cartData.discount,
        shipping: shippingInfo.fee,
        total: order.total_amount,
      },
    },
  };
};

export const cancelOrderService = async (orderId, user, body) => {
  const order = await OrderModel.findById(orderId);

  if (!order) {
    throw AppError.notFound(
      'Order',
      `Order with ID ${orderId} not found.`
    );
  }

  // 1. Ownership Validation
  if (user) {
    if (order.customer_id !== user.id) {
      throw AppError.forbidden(
        'Access denied',
        'You do not have permission to cancel this order.'
      );
    }
  } else {
    // Guest User
    if (
      order.customer_id ||
      !body?.email ||
      order.guest_email?.toLowerCase() !==
        body.email.trim().toLowerCase()
    ) {
      throw AppError.forbidden(
        'Access denied',
        'Invalid email or unauthorized access for guest cancellation.'
      );
    }
  }

  // 2. Status Validation & Idempotency
  if (order.status === 'CANCELLED') {
    return {
      success: true,
      message: 'Order is already cancelled.',
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: 'CANCELLED',
        },
      },
    };
  }

  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw AppError.badRequest(
      'Order cannot be cancelled',
      `Only PENDING or CONFIRMED orders can be cancelled.
       Current status: ${order.status}.`
    );
  }

  // 3. Fetch related records
  const [shippingRecord, paymentRecord] = await Promise.all([
    shipmentService.findShipmentByOrderId(order.id),
    findPaymentByOrderId(order.id),
  ]);

  // 4. Database Transaction - Core Business Changes
  await executeTransaction(async (client) => {
    const orderItems = await OrderItemModel.findByOrderId(
      orderId,
      client
    );

    // Restore stock
    for (const item of orderItems) {
      await prodVariantService.restoreProductStock(
        item.variant_id,
        item.quantity,
        client
      );
    }

    // Update Order
    await updateOrderStatus(
      order.id,
      { status: 'CANCELLED' },
      client
    );

    // Update Shipment Status
    if (shippingRecord) {
      await shipmentService.updateShippingRecord(
        shippingRecord.id,
        { status: 'CANCELLED' },
        client
      );
    }
  });

  // 5. External Services (Non-blocking)
  const warnings = [];

  // Payment Cancellation / Refund
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
    } catch {
      warnings.push(
        `Payment could not be refunded automatically.
         Please contact for support.`
      );
    }
  }

  // Shipment Cancellation
  if (shippingRecord) {
    try {
      await shippoService.cancelShippoShipment(
        shippingRecord?.transaction_id
      );
    } catch {
      warnings.push(
        `Shipment cancellation with carrier could not be completed.
        Please contact for support.`
      );
    }
  }

  // 6. Final Response
  const updatedOrder = await OrderModel.findById(orderId);

  return {
    success: true,
    message: 'Order cancelled successfully.',
    data: {
      order: {
        id: updatedOrder.id,
        order_number: updatedOrder.order_number,
        status: updatedOrder.status,
        payment_status: updatedOrder.payment_status,
        cancelled_at: updatedOrder.cancelled_at,
      },
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
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
    take: limit,
    cursor: cursor || undefined,
    include: {
      items: {
        select: {
          id: true,
          variant_id: true,
          quantity: true,
          total_price: true,
        },
      },
    },
  });

  // Handle pagination
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

  // Authorization checks
  if (user.id !== order.customer_id) {
    throw AppError.forbidden(
      'Order access denied.',
      'You do not have permission to view this order.'
    );
  }

  return {
    success: true,
    message: 'Data retireved successfully',
    order: buildPublicResponsePayload(order, false),
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

  if (query.email !== order.guest_email.toLowerCase()) {
    throw AppError.forbidden(
      'Order access denied',
      'You do not have permission to view this order.'
    );
  }

  return {
    success: true,
    message: 'Data retrieved successfully',
    order: buildPublicResponsePayload(order, true),
  };
};

// Shared Service //
export const findOrderById = async (orderId, client) =>
  OrderModel.findById(orderId, client);

export const updateOrderStatus = async (orderId, payload, client) =>
  OrderModel.updateStatus(orderId, payload, client);

export const findItemsByOrderId = async (orderId, client) =>
  OrderItemModel.findByOrderId(orderId, client);

function buildPublicResponsePayload(order, isGuest) {
  return {
    id: order.id,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    subtotal: order.subtotal,
    discount_amount: order.discount_amount,
    shipping_cost: order.shipping_cost,
    total_amount: order.total_amount,
    placed_at: order.placed_at,
    items_count: order.items.length,
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
    items: order.items.map((item) => ({
      id: item.id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    })),
    shipments: order.shipments.map((ship) => ({
      id: ship.id,
      status: ship.status,
      carrier: ship.carrier,
      tracking_number: ship.tracking_number,
      delivered_at: ship.delivered_at,
      shipped_at: ship.shipped_at,
    })),
    payments: order.payments.map((pay) => ({
      id: pay.id,
      status: pay.status,
      method: pay.method,
      amount: pay.amount,
      paid_at: pay.paid_at,
    })),
  };
}
