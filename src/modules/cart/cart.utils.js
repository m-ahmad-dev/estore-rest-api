export const getAvailableStock = (variant) =>
  Math.max(
    0,
    variant.stock_quantity - (variant.reserved_quantity ?? 0)
  );

/**
 * Single canonical cart item presenter used across all responses.
 * Includes available_stock only when explicitly requested (e.g. addCartItem).
 *
 * @param {object} item         - Raw cart item with nested variant
 * @param {object} [options]
 * @param {boolean} [options.withStock=false] - Include available_stock for UX feedback
 */
export const formatCartItem = (item, { withStock = false } = {}) => {
  const unitPrice = parseFloat(item.variant.price);

  const formatted = {
    id: item.id,
    variant_id: item.variant_id,
    quantity: item.quantity,
    unit_price: unitPrice,
    line_total: parseFloat((unitPrice * item.quantity).toFixed(2)),
    variant: {
      id: item.variant.id,
      sku: item.variant.sku,
    },
  };

  if (withStock) {
    formatted.available_stock = getAvailableStock(item.variant);
  }

  return formatted;
};

// Calculates cart subtotal from an array of cart items
export const calculateSubtotal = (items = []) => {
  if (!Array.isArray(items)) return 0;

  return items.reduce((total, item) => {
    const price = item?.variant?.price ?? 0;
    const quantity = item?.quantity ?? 0;
    return total + Number(price) * quantity;
  }, 0);
};

/**
 * Calculates discount amount based on coupon type.
 * Caps PERCENTAGE discounts at max_discount if defined.
 * Caps any discount at subtotal (never negative total).
 *
 * @param {number} subtotal
 * @param {object} coupon
 * @returns {number} discount amount (2 decimal places)
 */
export const calculateDiscount = (subtotal, coupon) => {
  if (!coupon || subtotal <= 0) return 0;

  let amount = 0;

  if (coupon.type === 'PERCENTAGE') {
    const raw = (subtotal * Number(coupon.value)) / 100;
    amount = coupon.max_discount
      ? Math.min(raw, Number(coupon.max_discount))
      : raw;
  } else if (coupon.type === 'FIXED') {
    amount = Number(coupon.value);
  }

  // Discount cannot exceed the subtotal
  return parseFloat(Math.min(amount, subtotal).toFixed(2));
};

/**
 * Builds the pricing summary block used in getCart and applyCoupon responses.
 *
 * @param {number} subtotal
 * @param {number} discount
 * @param {number} [shipping=0]
 * @returns {{ subtotal, discount, shipping, total }}
 */
export const buildPricingSummary = (
  subtotal,
  discount,
  shipping = 0
) => ({
  subtotal: parseFloat(subtotal.toFixed(2)),
  discount,
  shipping,
  total: parseFloat((subtotal - discount + shipping).toFixed(2)),
});
