import AppError from '../../core/utils/error.utils.js';
import ReviewsModel from './reviews.model.js';
import executeTransaction from '../../core/utils/dbTransaction.js';
import { checkProductExist } from '../products/product.service.js';
import { findOrderById } from '../orders/order.service.js';
import { findManyVariantsByIds } from '../products/variants/variants.service.js';
import { findCustomerById } from '../customer/customer.service.js';

/**
 * Creates a new product review with comprehensive validation and business rules.
 */
export const createProductReview = async (
  customerId,
  productId,
  body
) => {
  const { order_id, rating, title, comment } = body;

  return executeTransaction(async (client) => {
    // Verify order exists and belongs to customer
    const order = await findOrderById(order_id, client);
    if (!order) {
      throw AppError.notFound(
        'Order',
        `Order with ID ${order_id} not found.`
      );
    }

    if (order.customer_id !== customerId) {
      throw AppError.forbidden(
        'Unauthorized',
        'You can only review items from your own purchases.'
      );
    }

    // Business rule: Only delivered orders
    if (order.status !== 'DELIVERED') {
      throw AppError.badRequest(
        'Invalid Request',
        'You can only review items from orders that have been successfully delivered.'
      );
    }

    // Verify product is active and exists
    const product = await checkProductExist(productId, client);
    if (!product?.exists || product.deleted || !product.active) {
      throw AppError.notFound(
        'Product',
        'This product is no longer available for reviews.'
      );
    }

    // Verify product was part of the order
    const variantIds = order.items
      .map((item) => item.variant_id)
      .filter(Boolean);

    const variants = await findManyVariantsByIds(variantIds, client);
    const associatedProductIds = [
      ...new Set(variants.map((v) => v.product_id)),
    ];

    if (!associatedProductIds.includes(productId)) {
      throw AppError.badRequest(
        'Invalid Request',
        'The specified product does not belong to this order.'
      );
    }

    // Prevent duplicate reviews
    const existingReview = await ReviewsModel.findByComposite(
      { order_id, productId, customerId },
      client
    );

    if (existingReview) {
      throw AppError.conflict(
        'Duplicate Review',
        'You have already submitted a review for this product in this order.'
      );
    }

    // Prepare and save review
    const reviewData = {
      customer_id: customerId,
      product_id: productId,
      order_id,
      rating,
      title: title?.trim() || null,
      comment: comment?.trim() || null,
      status: 'PENDING',
      verified_purchase: true,
    };

    const savedReview = await ReviewsModel.create(reviewData, client);

    return {
      success: true,
      message:
        'Review has been submitted successfully and is awaiting moderation approval.',
      review: {
        id: savedReview.id,
        rating: savedReview.rating,
        title: savedReview.title,
        comment: savedReview.comment,
        status: savedReview.status,
        helpful_count: savedReview.helpful_count,
        created_at: savedReview.created_at,
      },
    };
  });
};

export const updateReview = async (customerId, reviewId, body) => {
  return executeTransaction(async (client) => {
    // Fetch existing review
    const review = await ReviewsModel.findById(reviewId, client);

    if (!review) {
      throw AppError.notFound(
        'Review',
        `Review with ID ${reviewId} not found.`
      );
    }

    // Authorization check
    if (review.customer_id !== customerId) {
      throw AppError.forbidden(
        'Access Denied',
        'You do not have permission to modify this review.'
      );
    }

    // Business Rule: If review is already approved, reset to PENDING for re-moderation
    const updateData = { ...body };

    if (review.status === 'APPROVED') {
      updateData.status = 'PENDING';
      updateData.approved_by = null;
      updateData.approved_at = null;
      updateData.rejection_reason = null;
    }

    // Perform update
    const updatedReview = await ReviewsModel.update(
      { id: reviewId },
      updateData,
      client
    );

    return {
      success: true,
      message:
        updatedReview.status === 'PENDING'
          ? 'Review updated successfully and is awaiting re-approval.'
          : 'Review updated successfully.',
      data: {
        id: updatedReview.id,
        rating: updatedReview.rating,
        title: updatedReview.title,
        comment: updatedReview.comment,
        status: updatedReview.status,
        helpful_count: updatedReview.helpful_count,
        updated_at: updatedReview.updated_at,
      },
    };
  });
};

export const deleteService = async (userId, reviewId, isAdmin) => {
  return await executeTransaction(async (client) => {
    const review = await ReviewsModel.findById(reviewId, client);

    if (!review) {
      throw AppError.notFound(
        'Review',
        `Review with ID ${reviewId} not found.`
      );
    }

    if (!isAdmin) {
      // Authorization check
      if (review.customer_id !== userId) {
        throw AppError.forbidden(
          'Access Denied',
          'You do not have permission to modify this review.'
        );
      }
    }

    await ReviewsModel.deleteById(reviewId, client);

    return {
      success: true,
      message: 'Review deleted successfully',
      id: reviewId,
    };
  });
};

export const getCustomerReviews = async (customerId, query = {}) => {
  const limit = parseInt(query.limit) || 10;
  const status = query.status?.toUpperCase();
  const cursor = query.cursor;

  return executeTransaction(async (client) => {
    const where = {
      customer_id: customerId,
      ...(status && { status }),
    };

    const reviews = await ReviewsModel.findWithPagination(
      {
        where,
        take: limit,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { created_at: 'desc' },
      },
      client
    );

    const nextCursor =
      reviews.length === limit
        ? reviews[reviews.length - 1].id
        : null;

    const totalReviews = await ReviewsModel.countBy(
      { customer_id: customerId },
      client
    );

    return {
      success: true,
      reviews: reviews.map((r) => ({
        id: r.id,
        product_id: r.product_id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        status: r.status,
        rejection_reason:
          r.status === 'REJECTED' ? r.rejection_reason : null,
        verified_purchase: r.verified_purchase,
        helpful_count: r.helpful_count,
        created_at: r.created_at,
        updated_at: r.updated_at,
        approved_at: r.approved_at,
      })),
      pagination: {
        limit,
        nextCursor,
        hasMore: !!nextCursor,
        totalReviews,
      },
    };
  });
};

export const findForProduct = async (productId, query = {}) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const rating = query.rating ? parseInt(query.rating) : undefined;
  const sortField = query.sort || 'created_at';
  const sortOrder =
    query.order?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  const skip = (page - 1) * limit;

  return executeTransaction(async (client) => {
    const product = await checkProductExist(productId, client);
    if (!product?.exists || product.deleted || !product.active) {
      throw AppError.notFound(
        'Product',
        'Product not found or unavailable.'
      );
    }

    const where = {
      product_id: productId,
      status: 'APPROVED',
      ...(rating && { rating }),
    };

    const [reviews, stats] = await Promise.all([
      ReviewsModel.findWithPagination(
        {
          where,
          take: limit,
          skip,
          orderBy: { [sortField]: sortOrder },
        },
        client
      ),

      ReviewsModel.stats(productId, client),
    ]);

    return {
      success: true,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        verified_purchase: r.verified_purchase,
        helpful_count: r.helpful_count,
        created_at: r.created_at,
        customer: r.customer
          ? {
              name: r.customer.first_name
                ? `${r.customer.first_name} ${r.customer.last_name ? r.customer.last_name[0] + '.' : ''}`.trim()
                : 'Anonymous',
            }
          : null,
      })),
      meta: {
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews,
      },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(stats.totalReviews / limit),
        hasNext: page * limit < stats.totalReviews,
        hasPrevious: page > 1,
      },
    };
  });
};

export const getAllReviews = async (query = {}) => {
  const {
    cursor,
    limit = 20,
    status,
    rating,
    customer_id,
    product_id,
    search,
    sort = 'created_at',
    order = 'desc',
  } = query;

  return executeTransaction(async (client) => {
    // Validate filters only if provided
    if (product_id) {
      const product = await checkProductExist(product_id, client);
      if (!product?.exists || product.deleted || !product.active) {
        throw AppError.notFound(
          'Product',
          'Product not exist or unavailable.'
        );
      }
    }

    if (customer_id) {
      const customer = await findCustomerById(customer_id, client);
      if (!customer || customer.deleted_at || !customer.is_active) {
        throw AppError.notFound(
          'Customer',
          'Customer not exit or inactive.'
        );
      }
    }

    const rows = await ReviewsModel.findAllForAdmin(
      {
        cursor,
        limit: parseInt(limit),
        status,
        rating: rating ? parseInt(rating) : undefined,
        customer_id,
        product_id,
        search,
        sort,
        order,
      },
      client
    );

    const hasMore = rows.length > limit;
    const reviews = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? reviews[reviews.length - 1].id
      : null;

    const totalReviews = await ReviewsModel.countBy(
      undefined,
      client
    );

    return {
      success: true,
      data: {
        reviews: reviews.map((r) => ({
          id: r.id,
          title: r.title,
          comment: r.comment,
          rating: r.rating,
          status: r.status,
          helpful_count: r.helpful_count,
          verified_purchase: r.verified_purchase,
          created_at: r.created_at,
          product: {
            id: r.product_id,
            name: r.product_name,
            slug: r.product_slug,
          },
          customer: {
            id: r.customer_id,
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.customer_email,
          },
        })),
        pagination: {
          limit: parseInt(limit),
          total: totalReviews,
          hasNext: hasMore,
          nextCursor,
        },
      },
    };
  });
};

export const getReviewDetails = async (reviewId) => {
  const review = await ReviewsModel.findWithDetails({ id: reviewId });

  if (!review) {
    throw AppError.notFound(
      'Review',
      'The requested review not exist or has been deleted.'
    );
  }

  return {
    success: true,
    message: 'Data retrieved successfuly',
    review,
  };
};

export const updateReviewStatus = async (adminId, reviewId, body) => {
  return executeTransaction(async (client) => {
    const review = await ReviewsModel.findById(reviewId, client);

    if (!review) {
      throw AppError.notFound(
        'Review',
        'Review not exist or has been deleted.'
      );
    }

    const updateData = {
      status: body.status,
    };

    if (body.status === 'APPROVED') {
      updateData.approved_by = adminId;
      updateData.approved_at = new Date();
      updateData.rejection_reason = null;
    } else if (body.status === 'REJECTED') {
      updateData.rejection_reason = body.rejection_reason?.trim();
      updateData.approved_by = null;
      updateData.approved_at = null;
    } else {
      // PENDING
      updateData.rejection_reason = null;
      updateData.approved_by = null;
      updateData.approved_at = null;
    }

    const updatedReview = await ReviewsModel.update(
      { id: reviewId },
      updateData,
      client
    );

    return {
      success: true,
      message: `Review has been ${body.status.toLowerCase()} successfully.`,
      review: {
        id: updatedReview.id,
        title: updatedReview.title,
        rating: updatedReview.rating,
        status: updatedReview.status,
        rejection_reason: updatedReview.rejection_reason,
        approved_at: updatedReview.approved_at,
        approved_by: updatedReview.approved_by,
      },
    };
  });
};
