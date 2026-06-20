import executeTransaction from '../../core/utils/dbTransaction.js';
import { CartModel, CartItemModel } from './cart.model.js';
import { findVariantById } from '../products/variants/variants.service.js';
import {
  findCouponByCode,
  findCouponById,
} from '../coupons/coupons.service.js';
import AppError from '../../core/utils/error.utils.js';
import * as cartUtils from './cart.utils.js';
import { findManyProductsByIds } from '../products/product.service.js';

const resolveCartUser = (user) => {
  const { customer_id, session_id } = user;

  if (!customer_id && !session_id) {
    throw AppError.badRequest(
      'Either customer_id or session_id must be provided'
    );
  }

  return { customer_id, session_id };
};

const findActiveCart = async (client, customerId, sessionId) => {
  const cart = customerId
    ? await CartModel.findActiveByCustomer(customerId, client)
    : await CartModel.findActiveBySession(sessionId, client);

  if (!cart) return null;

  // Expire carts that have passed their TTL
  if (cart.expires_at && new Date(cart.expires_at) < new Date()) {
    await CartModel.markAsAbandoned(cart.id, client);
    return null;
  }

  return cart;
};

// Ensures an active cart exists and returns it,
// otherwise throws a 404 error
const requireActiveCart = async (client, customerId, sessionId) => {
  const cart = await findActiveCart(client, customerId, sessionId);

  if (!cart) {
    throw AppError.notFound('Cart', 'No active cart found');
  }

  return cart;
};

// Finds an active cart or creates a new one
const findOrCreateActiveCart = async (
  client,
  customerId,
  sessionId
) => {
  const existing = await findActiveCart(
    client,
    customerId,
    sessionId
  );
  if (existing) return existing;

  return CartModel.create(customerId, sessionId, client);
};

const assertCouponApplicable = (coupon, subtotal) => {
  if (!coupon) {
    throw AppError.notFound('Coupon', 'Invalid coupon code');
  }

  const now = new Date();

  if (!coupon.is_active) {
    throw AppError.badRequest('This coupon is not active');
  }
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    throw AppError.badRequest('This coupon is not yet available');
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    throw AppError.badRequest('This coupon has expired');
  }
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    throw AppError.badRequest(
      'This coupon has reached its usage limit'
    );
  }
  if (
    coupon.min_order_value &&
    subtotal < Number(coupon.min_order_value)
  ) {
    throw AppError.badRequest(
      `Minimum order value for this coupon is 
      ${Number(coupon.min_order_value).toFixed(2)}`
    );
  }
};

const isCouponStillValid = (coupon, subtotal) => {
  if (!coupon || !coupon.is_active) return false;

  const now = new Date();

  if (coupon.starts_at && new Date(coupon.starts_at) > now)
    return false;
  if (coupon.expires_at && new Date(coupon.expires_at) < now)
    return false;
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses)
    return false;
  if (
    coupon.min_order_value &&
    subtotal < Number(coupon.min_order_value)
  )
    return false;

  return true;
};

// < MAIN SERVICES > //

export const addCartItem = async (user, payload) => {
  const { customer_id, session_id } = resolveCartUser(user);
  const { variant_id, quantity = 1 } = payload;

  return executeTransaction(async (client) => {
    const variant = await findVariantById(variant_id, client);

    if (!variant || variant.deleted_at) {
      throw AppError.notFound(
        'Variant',
        'Product variant not found or no longer available'
      );
    }

    const availableStock = cartUtils.getAvailableStock(variant);

    if (availableStock < quantity) {
      throw AppError.badRequest(
        `Only ${availableStock} unit${availableStock === 1 ? '' : 's'}
         available for this variant`
      );
    }

    const cart = await findOrCreateActiveCart(
      client,
      customer_id,
      session_id
    );

    const existing = await CartItemModel.findByCartAndVariant(
      cart.id,
      variant_id,
      client
    );
    if (existing) {
      throw AppError.conflict(
        'Item already in cart',
        `This variant is already in your cart. 
        Use the update endpoint to change quantity.`
      );
    }

    const cartItem = await CartItemModel.create(
      cart.id,
      variant_id,
      quantity,
      client
    );

    return {
      success: true,
      message: 'Item added to cart',
      item: cartUtils.formatCartItem(cartItem, {
        withStock: true,
      }),
    };
  });
};

export const updateCartItem = async (itemId, user, payload) => {
  const { customer_id, session_id } = resolveCartUser(user);
  const { action, quantity: inputQuantity } = payload;

  return executeTransaction(async (client) => {
    const cart = await requireActiveCart(
      client,
      customer_id,
      session_id
    );

    const cartItem = await CartItemModel.findByCartAndId(
      cart.id,
      itemId,
      client
    );
    if (!cartItem) {
      throw AppError.notFound(
        'Cart item',
        'Item not found in your cart'
      );
    }

    const variant = await findVariantById(
      cartItem.variant_id,
      client
    );
    if (!variant || variant.deleted_at) {
      throw AppError.notFound(
        'Variant',
        'Product variant is no longer available'
      );
    }

    const availableStock = cartUtils.getAvailableStock(variant);

    let newQuantity = cartItem.quantity;

    switch (action) {
      case 'increment':
        newQuantity += inputQuantity;
        break;
      case 'decrement':
        newQuantity -= inputQuantity;
        break;
      case 'replace':
        newQuantity = inputQuantity;
        break;
      default:
        throw AppError.badRequest(
          'Action must be increment, decrement, or replace'
        );
    }

    if (newQuantity < 1) {
      throw AppError.badRequest(
        `Quantity cannot be less than 1. 
        Use the delete endpoint to remove the item.`
      );
    }

    if (newQuantity > availableStock) {
      throw AppError.badRequest(
        `Insufficient stock. Only ${availableStock} 
        unit${availableStock === 1 ? '' : 's'} available.`
      );
    }

    await CartItemModel.update(
      itemId,
      { quantity: newQuantity },
      client
    );

    return {
      success: true,
      message: 'Cart item updated',
      item: {
        id: itemId,
        quantity: newQuantity,
      },
    };
  });
};

export const removeCartItem = async (itemId, user) => {
  const { customer_id, session_id } = resolveCartUser(user);

  return executeTransaction(async (client) => {
    const cart = await requireActiveCart(
      client,
      customer_id,
      session_id
    );

    const cartItem = await CartItemModel.findByCartAndId(
      cart.id,
      itemId,
      client
    );
    if (!cartItem) {
      throw AppError.notFound(
        'Cart item',
        'Item not found in your cart'
      );
    }

    await CartItemModel.delete(itemId, client);

    return {
      success: true,
      message: 'Item removed from cart',
      id: itemId,
    };
  });
};

export const clearCart = async (user) => {
  const { customer_id, session_id } = resolveCartUser(user);

  return executeTransaction(async (client) => {
    const cart = await requireActiveCart(
      client,
      customer_id,
      session_id
    );

    await CartItemModel.deleteByCart(cart.id, client);
    await CartModel.markAsAbandoned(cart.id, client);

    return {
      success: true,
      message: 'Cart cleared sucessfully',
    };
  });
};

export const applyCoupon = async (user, code) => {
  const { customer_id, session_id } = resolveCartUser(user);

  return executeTransaction(async (client) => {
    const cart = await requireActiveCart(
      client,
      customer_id,
      session_id
    );

    const items = await CartItemModel.findByCart(cart.id, client);
    if (items.length === 0) {
      throw AppError.badRequest(
        'Cart is empty',
        'Add items before applying a coupon'
      );
    }

    const coupon = await findCouponByCode(code, client);
    const subtotal = cartUtils.calculateSubtotal(items);

    // Throws descriptive errors if coupon is not applicable
    assertCouponApplicable(coupon, subtotal);

    await CartModel.update(cart.id, { coupon_id: coupon.id }, client);

    return {
      success: true,
      message: 'Coupon applied successfully',
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
      },
    };
  });
};

export const removeCoupon = async (user) => {
  const { customer_id, session_id } = resolveCartUser(user);

  return executeTransaction(async (client) => {
    const cart = await requireActiveCart(
      client,
      customer_id,
      session_id
    );

    if (!cart.coupon_id) {
      return {
        success: true,
        message: 'No coupon was applied',
      };
    }

    await CartModel.update(cart.id, { coupon_id: null }, client);

    return {
      success: true,
      message: 'Coupon removed',
    };
  });
};

export const getCart = async (user) => {
  const { customer_id, session_id } = resolveCartUser(user);

  return executeTransaction(async (client) => {
    const cart = await findActiveCart(
      client,
      customer_id,
      session_id
    );

    if (!cart) return buildEmptyCartResponse();

    const items = await CartItemModel.findByCart(cart.id, client);
    const subtotal = cartUtils.calculateSubtotal(items);
    const items_count = items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    let discount = 0;
    let couponResponse = null;

    if (cart.coupon_id) {
      const coupon = await findCouponById(cart.coupon_id, client);

      if (isCouponStillValid(coupon, subtotal)) {
        discount = cartUtils.calculateDiscount(subtotal, coupon);
        couponResponse = {
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          value: Number(coupon.value),
        };
      } else {
        // Coupon expired or became invalid — clear it silently
        await CartModel.update(cart.id, { coupon_id: null }, client);
      }
    }

    const pricing = cartUtils.buildPricingSummary(subtotal, discount);

    return {
      success: true,
      message: 'Cart retrieved successfully',
      cart: {
        id: cart.id,
        items: items.map((item) => cartUtils.formatCartItem(item)),
        items_count,
        coupon: couponResponse,
        ...pricing,
      },
    };
  });
};

/**
 * Intended for internal use by checkout / order creation services.
 * @returns {{ cart, items, subtotal, discount, total, coupon } | null}
 */
export const resolveCartForCheckout = async (
  user,
  checkoutContext,
  client
) => {
  const { customer_id, session_id } = resolveCartUser(user);
  const cart = await requireActiveCart(
    client,
    customer_id,
    session_id
  );

  let items = await CartItemModel.findByCart(cart.id, client);
  if (items.length === 0) {
    throw AppError.badRequest(
      'Cart is empty',
      'Please add items before placing an order.'
    );
  }

  // Enrich and validate items (product lookup moved here)
  const productIds = [
    ...new Set(
      items.map((item) => item.variant?.product_id).filter(Boolean)
    ),
  ];
  const products = await findManyProductsByIds(productIds, client);
  const productMap = new Map(products.map((p) => [p.id, p]));

  items = items.map((item) => {
    const product = productMap.get(item.variant.product_id);
    if (!product || product.deleted_at || !product.is_active) {
      throw AppError.badRequest(
        'Product unavailable',
        `Product for variant ${item.variant.sku} is no longer available.`
      );
    }
    if (cartUtils.getAvailableStock(item.variant) < item.quantity) {
      throw AppError.badRequest(
        'Insufficient stock',
        `Insufficient stock for variant '${item.variant.sku}'.`
      );
    }
    return {
      ...item,
      product_name: product.name, // Enrich for order items
    };
  });

  const subtotal = cartUtils.calculateSubtotal(items);
  const totalWeight = cartUtils.calculateTotalWeight(items);

  let discount = 0;
  if (cart.coupon_id) {
    const foundCoupon = await findCouponById(cart.coupon_id, client);
    if (isCouponStillValid(foundCoupon, subtotal)) {
      discount = cartUtils.calculateDiscount(subtotal, foundCoupon);
    }
  }

  return {
    cart,
    items,
    subtotal,
    discount,
    totalWeight,
  };
};

// Private Helper
const buildEmptyCartResponse = () => ({
  success: true,
  message: 'Cart retrieved successfully',
  cart: {
    id: null,
    items: [],
    items_count: 0,
    coupon: null,
    subtotal: 0,
    discount: 0,
    shipping: 0,
    total: 0,
  },
});
