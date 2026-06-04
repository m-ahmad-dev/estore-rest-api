import executeTransaction from '../../core/utils/dbTransaction.js';
import AppError from '../../core/utils/error.utils.js';
import CouponsModel from './coupons.model.js';

export const createCouponService = async (payload) => {
  return await executeTransaction(async (client) => {
    const existing = await CouponsModel.findByCode(
      payload.code,
      client
    );

    if (existing) {
      throw AppError.conflict(
        'Coupon already exists',
        `A coupon with code "${payload.code}" already exists.`
      );
    }

    const now = new Date();
    const data = {
      ...payload,
      starts_at: payload.starts_at || now,
      expires_at: payload.expires_at || null,
      value: payload.value,
      min_order_value: payload.min_order_value || 0,
      max_discount: payload.max_discount || null,
      max_uses: payload.max_uses || null,
    };

    const coupon = await CouponsModel.create(data, client);

    return {
      success: true,
      message: 'Coupon created successfully',
      coupon,
    };
  });
};

export const updateCouponService = async (id, payload) => {
  return executeTransaction(async (client) => {
    const existingCoupon = await CouponsModel.findById(id, client);
    if (!existingCoupon) {
      throw AppError.notFound(
        'Coupon',
        `No coupon found with id: ${id}`
      );
    }

    // Guard Clauses & Validations
    if (payload.code && payload.code !== existingCoupon.code) {
      const codeExists = await CouponsModel.findByCode(
        payload.code,
        client
      );
      if (codeExists) {
        throw AppError.conflict(
          'Coupon code already exists',
          `Another coupon with code "${payload.code}" already exists.`
        );
      }
    }

    if (
      payload.type &&
      payload.type !== existingCoupon.type &&
      existingCoupon.used_count > 0
    ) {
      throw AppError.badRequest(
        'Cannot change coupon type',
        'Cannot change coupon type after it has been used.'
      );
    }

    // Strips out undefined values dynamically using Object.fromEntries
    const updateData = Object.fromEntries(
      Object.entries({ ...payload }).filter(
        ([_, val]) => val !== undefined
      )
    );
    const updatedCoupon = await CouponsModel.update(
      id,
      updateData,
      client
    );

    return {
      success: true,
      message: 'Coupon updated successfully',
      coupon: updatedCoupon,
    };
  });
};

export const getCouponById = async (id) => {
  const coupon = await CouponsModel.findById(id);

  if (!coupon) {
    throw AppError.notFound(
      'Coupon',
      `No coupon found with id: ${id}`
    );
  }

  return coupon;
};

// Fetch all coupons with cursor-based pagination and filters
export const getAllCoupons = async (queryParams) => {
  const {
    cursor,
    search,
    is_active: isActive,
    type,
    limit = 10,
  } = queryParams;
  const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const where = {};

  if (search) {
    where.code = { contains: search, mode: 'insensitive' };
  }

  if (isActive !== undefined) {
    where.is_active = isActive === 'true';
  }

  if (type) {
    where.type = type;
  }

  const queryOptions = {
    where,
    orderBy: { id: 'asc' },
    take: take + 1,
  };

  // Handle cursor pagination
  if (cursor) {
    const decodedId = Buffer.from(cursor, 'base64').toString('ascii');
    queryOptions.cursor = { id: decodedId };
    queryOptions.skip = 1;
  }

  const records = await CouponsModel.findAll(queryOptions);

  const hasNextPage = records.length > take;
  const coupons = hasNextPage ? records.slice(0, take) : records;

  // Generate next cursor from the last record
  const nextCursor =
    hasNextPage && coupons.length > 0
      ? Buffer.from(
          coupons[coupons.length - 1].id.toString()
        ).toString('base64')
      : null;

  return {
    success: true,
    message: 'Data retrieved successfully',
    coupons,
    meta: {
      limit: take,
      hasNextPage,
      nextCursor,
    },
  };
};

// Shared Service
export const findCouponByCode = async (code, client) => {
  return await CouponsModel.findByCode(code, client);
};

export const findCouponById = async (id, client) => {
  return await CouponsModel.findById(id, client);
};
