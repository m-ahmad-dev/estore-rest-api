import crypto from 'crypto';
import AppError from '../../core/utils/error.utils.js';
import executeTransaction from '../../core/utils/dbTransaction.js';
import * as cartService from '../cart/cart.service.js';
import * as addressService from '../address/address.service.js';
import { findCustomerById } from '../customer/customer.service.js';
import { OrderModel, OrderItemModel } from './order.model.js';
import { updateVariantStockService } from '../products/variants/variants.service.js';
import { createShipmentRecord } from '../shipments/shipments.service.js';
import { processOrderPaymentIntent } from '../payment/stripe.service.js';

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
      country_code: address.country_code || 'PK',
    };
  }
  return data.guest_address;
};

// Main Services //
export const createOrderService = async (user, data) => {
  // Pre-transaction validations and preparations
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

  // Resolve cart and pricing (outside transaction where possible)
  const cartData = await cartService.resolveCartForCheckout(
    user,
    checkoutContext
  );

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
      shipping_cost: cartData.shipping,
      total_amount: cartData.total,
    };

    const newOrder = await OrderModel.create(orderPayload, client);

    // Create order items
    const orderItemPayloads = cartData.items.map((item) => ({
      order_id: newOrder.id,
      variant_id: item.variant_id,
      product_name: item.product_name || item.variant?.product?.name, // Assume enriched by cart service
      sku: item.variant.sku,
      variant_options: item.variant.attributes,
      quantity: item.quantity,
      unit_price: item.variant.price,
      total_price: item.quantity * item.variant.price,
    }));

    await OrderItemModel.insertMany(orderItemPayloads, client);

    // Reserve stock
    for (const item of cartData.items) {
      await updateVariantStockService(
        item.variant.product_id,
        item.variant_id,
        { quantity: item.quantity, operation: 'stock.reserve' },
        client
      );
    }

    // Create shipment
    await createShipmentRecord(
      newOrder.id,
      {
        order_id: newOrder.id,
        carrier: cartData.shippingRecord.carrier,
        tracking_number: cartData.shippingRecord.trackingNumber,
        status: cartData.shippingRecord.status,
      },
      client
    );

    return { order: newOrder };
  });

  // Post-transaction payment handling
  let paymentIntent = null;
  if (data.payment_method === 'CARD') {
    paymentIntent = await processOrderPaymentIntent(order.id);
  }

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
      shipping: cartData.shippingRecord,
      summary: {
        subtotal: cartData.subtotal,
        discount: cartData.discount,
        shipping: cartData.shipping,
        total: cartData.total,
      },
    },
  };
};

// Shared query methods (unchanged, with optional client support)
export const findOrderById = async (orderId, client) =>
  OrderModel.findById(orderId, client);

export const updateOrderStatus = async (orderId, payload, client) =>
  OrderModel.updateStatus(orderId, payload, client);

export const findItemsByOrderId = async (orderId, client) =>
  OrderItemModel.findByOrderId(orderId, client);
