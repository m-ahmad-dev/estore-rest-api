import prisma from '../../core/configs/db.js';
import AppError from '../../core/utils/error.utils.js';

const normalizeCouponCode = (code) =>
  code?.trim().toUpperCase() || null;

const normalizeDate = (value) => {
  if (value === undefined) return undefined;
  return value === null || value === '' ? null : new Date(value);
};

export const findCouponByCode = async (code, client = prisma) => {
  const normalizedCode = normalizeCouponCode(code);
  return normalizedCode
    ? client.coupons.findUnique({ where: { code: normalizedCode } })
    : null;
};

export const findCouponById = async (id, client = prisma) => {
  return id ? client.coupons.findUnique({ where: { id } }) : null;
};

export const createCoupon = async (payload) => {
  const data = {
    code: normalizeCouponCode(payload.code),
    type: payload.type,
    value: payload.value,
    min_order_value: payload.min_order_value ?? 0,
    max_uses: payload.max_uses ?? null,
    max_discount:
      payload.type === 'FIXED'
        ? null
        : (payload.max_discount ?? null),
    is_active: payload.is_active ?? true,
    starts_at: payload.starts_at
      ? new Date(payload.starts_at)
      : new Date(),
    expires_at: payload.expires_at
      ? new Date(payload.expires_at)
      : null,
  };

  return prisma.coupons.create({ data });
};

export const getCoupons = async (query = {}) => {
  const { cursor, search, type } = query;

  // Safety net: coerce to correct types in case middleware is bypassed
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || 10, 1),
    100
  );
  const is_active =
    query.is_active === 'true' || query.is_active === true
      ? true
      : query.is_active === 'false' || query.is_active === false
        ? false
        : undefined;

  const where = {
    ...(search && {
      code: { contains: search, mode: 'insensitive' },
    }),
    ...(is_active !== undefined && { is_active }),
    ...(type && { type }),
  };

  const [rawItems, total] = await Promise.all([
    prisma.coupons.findMany({
      where,
      take: limit + 1,
      orderBy: { created_at: 'desc' },
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    }),
    prisma.coupons.count({ where }),
  ]);

  const hasNextPage = rawItems.length > limit;
  const items = hasNextPage ? rawItems.slice(0, limit) : rawItems;
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;

  return {
    data: items,
    meta: {
      total,
      limit,
      nextCursor,
      hasNextPage,
    },
  };
};

export const getCouponById = async (id, client = prisma) => {
  const coupon = await findCouponById(id, client);

  if (!coupon) {
    const error = new Error('Coupon not found');
    error.statusCode = 404;
    throw error;
  }

  return coupon;
};

export const updateCoupon = async (id, payload) => {
  const existingCoupon = await getCouponById(id);
  const updatedType = payload.type ?? existingCoupon.type;

  const updateData = {};
  if (payload.code !== undefined)
    updateData.code = normalizeCouponCode(payload.code);
  if (payload.type !== undefined) updateData.type = payload.type;
  if (payload.value !== undefined) updateData.value = payload.value;
  if (payload.min_order_value !== undefined)
    updateData.min_order_value = payload.min_order_value;
  if (payload.max_uses !== undefined)
    updateData.max_uses = payload.max_uses;
  if (payload.is_active !== undefined)
    updateData.is_active = payload.is_active;
  if (payload.starts_at !== undefined)
    updateData.starts_at = normalizeDate(payload.starts_at);
  if (payload.expires_at !== undefined)
    updateData.expires_at = normalizeDate(payload.expires_at);

  if (updatedType === 'FIXED') {
    updateData.max_discount = null;
  } else if (payload.max_discount !== undefined) {
    updateData.max_discount = payload.max_discount;
  }

  return prisma.coupons.update({
    where: { id },
    data: updateData,
  });
};

export const deleteCoupon = async (id) => {
  await getCouponById(id);
  return prisma.coupons.delete({ where: { id } });
};

export const validateAndCalculateDiscount = async (
  code,
  orderSubtotal,
  client = prisma
) => {
  const coupon = await findCouponByCode(code, client);

  if (!coupon) throw AppError.badRequest('Invalid coupon code.');
  if (!coupon.is_active)
    throw AppError.badRequest('This coupon is currently inactive.');

  const now = new Date();
  if (coupon.starts_at && now < coupon.starts_at)
    throw AppError.badRequest('This coupon is not yet active.');
  if (coupon.expires_at && now > coupon.expires_at)
    throw AppError.badRequest('This coupon has expired.');
  if (
    coupon.max_uses !== null &&
    coupon.used_count >= coupon.max_uses
  ) {
    throw AppError.badRequest(
      'This coupon has reached its maximum usage limit.'
    );
  }

  const subtotal = Number(orderSubtotal);
  const minOrderValue = Number(coupon.min_order_value ?? 0);

  if (subtotal < minOrderValue) {
    throw AppError.badRequest(
      `Minimum order value of ${minOrderValue.toFixed(2)} is required for this coupon.`
    );
  }

  const couponValue = Number(coupon.value);
  let discountAmount = 0;

  if (coupon.type === 'PERCENTAGE') {
    const percentageDiscount = (subtotal * couponValue) / 100;
    discountAmount =
      coupon.max_discount !== null
        ? Math.min(percentageDiscount, Number(coupon.max_discount))
        : percentageDiscount;
  } else if (coupon.type === 'FIXED') {
    discountAmount = Math.min(couponValue, subtotal);
  }

  return {
    coupon,
    discountAmount: Number(discountAmount.toFixed(2)),
  };
};

export const incrementCouponUsage = async (couponId, tx = prisma) => {
  const coupon = await tx.coupons.findUnique({
    where: { id: couponId },
    select: { id: true, max_uses: true },
  });
  if (!coupon) throw AppError.badRequest('Coupon is no longer available.');

  const now = new Date();
  const conditions = [
    { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
    { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
  ];
  if (coupon.max_uses !== null && coupon.max_uses !== undefined) {
    conditions.push({ used_count: { lt: coupon.max_uses } });
  }

  // Conditional update prevents concurrent checkouts exceeding max_uses.
  const result = await tx.coupons.updateMany({
    where: { id: couponId, is_active: true, AND: conditions },
    data: { used_count: { increment: 1 } },
  });
  if (result.count !== 1) {
    throw AppError.badRequest('This coupon is no longer available or has reached its usage limit.');
  }
  return tx.coupons.findUnique({ where: { id: couponId } });
};

export const decrementCouponUsage = async (couponId, tx = prisma) => {
  if (!couponId) return { count: 0 };
  return tx.coupons.updateMany({
    where: { id: couponId, used_count: { gt: 0 } },
    data: { used_count: { decrement: 1 } },
  });
};
