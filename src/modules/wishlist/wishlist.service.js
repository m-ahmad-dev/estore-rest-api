import AppError from '../../core/utils/error.utils.js';
import executeTransaction from '../../core/utils/dbTransaction.js';
import { findProductById } from '../products/product.service.js';
import WishlistModel from './wishlist.model.js';

export const createWishlist = async (customerId, body) => {
  return await executeTransaction(async (client) => {
    const product = await findProductById(body.product_id, client);

    if (
      !product ||
      product.deleted_at !== null ||
      !product.is_active
    ) {
      throw AppError.notFound(
        'Product',
        "We can't seem to find this item anymore."
      );
    }

    const isExist = await WishlistModel.findByProductId(
      body.product_id,
      client
    );

    if (isExist) {
      throw AppError.conflict(
        'Item already exist',
        'Requested item is already marked in wishlist'
      );
    }

    const data = {
      customer_id: customerId,
      product_id: body.product_id,
    };

    await WishlistModel.create(data, client);

    return {
      success: true,
      message: 'Product added to wishlist successfully',
    };
  });
};

export const getUserWishlist = async (customerId, query = {}) => {
  if (!customerId) {
    throw new Error('Customer ID is required');
  }
  return await executeTransaction(async (client) => {
    const limit = Math.min(
      Math.max(Number(query.limit) || 20, 1),
      100
    );
    const sortOrder =
      query.sort?.toLowerCase() === 'oldest' ? 'asc' : 'desc';
    const cursorId = query.cursor || null;

    const records = await WishlistModel.findByCustomerId(
      {
        customerId,
        limit,
        cursor: cursorId,
        sortOrder,
      },
      client
    );

    const hasNextPage = records.length > limit;
    const wishlistItems = hasNextPage
      ? records.slice(0, limit)
      : records;

    const nextCursor =
      hasNextPage && wishlistItems.length > 0
        ? wishlistItems[wishlistItems.length - 1].id
        : null;

    const totalItems = await WishlistModel.countBy(
      { customer_id: customerId },
      client
    );

    return {
      success: true,
      message: 'Wishlist retrieved successfully',
      data: {
        wishlist: wishlistItems.map((item) => ({
          id: item.id,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            description: item.product.description,
            base_price: item.product.base_price,
            is_active: item.product.is_active,
            primary_image: item.product.images?.[0] || null,
          },
          added_at: item.added_at,
        })),
        pagination: {
          limit,
          hasNextPage,
          nextCursor,
          totalItems,
        },
      },
    };
  });
};

export const deleteRecord = async (customerId, wishId) => {
  if (!customerId) {
    throw new Error('Customer ID is required');
  }

  return await executeTransaction(async (client) => {
    const record = await WishlistModel.findById(wishId, client);

    if (!record) {
      throw AppError.notFound(
        'Item not found',
        'The item you are trying to remove does not exist.'
      );
    }

    if (record.customer_id !== customerId) {
      throw AppError.forbidden(
        'Action not allowed',
        'You do not have permission to remove this item.'
      );
    }

    await WishlistModel.deleteBy(wishId, client);

    return {
      success: true,
      message: 'Item removed successfully',
      id: wishId,
    };
  });
};
