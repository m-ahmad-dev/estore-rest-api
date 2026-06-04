import prisma from '../../../core/configs/db.js';
import executeTransaction from '../../../core/utils/dbTransaction.js';
import ProdVariantsModel from './variants.model.js';
import AppError from '../../../core/utils/error.utils.js';
import { findProductById } from '../product.service.js';
import {
  prepareVariants,
  formatAdminVariant,
  formatPublicVariant,
} from './variants.utils.js';
import { validateProductExists } from '../product.utils.js';

// ========= MAIN SERVICES =========

// Create multiple variants for a product
export const createVariantService = async (
  productId,
  variants,
  categoryId = null,
  client = prisma
) => {
  const product = await findProductById(productId, client);
  if (!product || product.deleted_at !== null) {
    throw AppError.notFound('Product', 'Product not exist or has been deleted');
  }

  const effectiveCategoryId = categoryId ?? product.category_id;
  const preparedVariants = await prepareVariants(
    productId,
    variants,
    effectiveCategoryId,
    client
  );

  if (preparedVariants.length === 0) {
    throw AppError.badRequest('At least one variant is required');
  }

  return await ProdVariantsModel.createMany(
    productId,
    preparedVariants,
    client
  );
};

// Update variant (only price and SKU - attributes are immutable after creation)
export const updateVariantService = async (productId, variantId, body) => {
  return executeTransaction(async (client) => {
    await validateProductExists(productId, client);

    const variant = await ProdVariantsModel.findById(variantId, client);
    if (!variant || variant.deleted_at !== null) {
      throw AppError.notFound('Variant');
    }

    if (variant.product_id !== productId) {
      throw AppError.badRequest(
        'Variant does not belong to the specified product'
      );
    }

    const { price, sku } = body;
    const updates = {
      ...(price !== undefined && { price }),
      ...(sku && { sku }),
    };

    if (Object.keys(updates).length === 0) {
      return formatResponse(variant);
    }

    // Ensure SKU uniqueness if changed
    if (sku && sku !== variant.sku) {
      const existingSKU = await ProdVariantsModel.findBySKU(sku, client);
      if (existingSKU) {
        throw AppError.badRequest(
          'SKU must be unique',
          `SKU ${sku} is already in use`
        );
      }
    }

    const updatedVariant = await ProdVariantsModel.update(
      productId,
      variantId,
      updates,
      client
    );

    return formatResponse(updatedVariant);
  });
};

// Soft delete or restore a variant
export const handleSoftDeleteOrRestore = async (
  productId,
  variantId,
  deletedAt = null
) => {
  return executeTransaction(async (client) => {
    await validateProductExists(productId, client);

    const variant = await ProdVariantsModel.findById(variantId, client);
    if (!variant) throw AppError.notFound('Variant');

    if (deletedAt && variant.deleted_at !== null) {
      throw AppError.notFound('Variant'); // Already deleted
    }

    if (variant.product_id !== productId) {
      throw AppError.badRequest(
        'Variant does not belong to the specified product'
      );
    }

    await ProdVariantsModel.softDeleteOrRestore(
      productId,
      variantId,
      deletedAt,
      client
    );

    return {
      success: true,
      message: deletedAt
        ? 'Variant deleted successfully'
        : 'Variant restored successfully',
      id: variantId,
      deletedAt,
    };
  });
};

// Update variant stock with different operations (add, reduce, reserve, etc.)
export const updateVariantStockService = async (
  productId,
  variantId,
  operation
) => {
  return executeTransaction(async (client) => {
    await validateProductExists(productId, client);

    const variant = await ProdVariantsModel.findById(variantId, client);

    if (!variant || variant.deleted_at !== null) {
      throw AppError.notFound(
        'Variant',
        'Variant not found or has been deleted'
      );
    }

    if (variant.product_id !== productId) {
      throw AppError.badRequest(
        'Variant does not belong to the specified product'
      );
    }

    const updatedVariant = await applyStockOperation(
      variant,
      operation,
      client
    );

    return formatResponse(updatedVariant);
  });
};

// Get all variants of a product
export const getProductVariantsService = async (productId, options = {}) => {
  const { isAdmin = false, includeDeleted = false } = options;

  // Security: Public users cannot request deleted variants
  if (!isAdmin && includeDeleted) {
    throw AppError.badRequest(
      'Invalid parameter',
      'include_deleted is not allowed for public users'
    );
  }

  await validateProductExists(productId);

  const variants = await ProdVariantsModel.findByProductId(
    productId,
    includeDeleted
  );

  return isAdmin
    ? variants.map(formatAdminVariant)
    : variants.map(formatPublicVariant);
};

// Get single variant by ID
export const getVariantService = async (productId, variantId, options = {}) => {
  const { isAdmin = false } = options;

  await validateProductExists(productId);

  const variant = await ProdVariantsModel.findById(variantId);
  if (!variant) throw AppError.notFound('Variant');

  if (!isAdmin && variant.deleted_at !== null)
    throw AppError.notFound('Variant');

  if (variant.product_id !== productId) {
    throw AppError.badRequest('Variant does not belong to this product');
  }

  return isAdmin ? formatAdminVariant(variant) : formatPublicVariant(variant);
};

// ======== SHARED UTILITIES ========

// Delete all variants of a product (used when deleting product)
export const bulkDeleteVariants = async (productId, client = prisma) => {
  return await ProdVariantsModel.deleteAllByProduct(productId, client);
};

// ========== STOCK OPERATIONS =========

const computeStockDelta = {
  'stock.add': ({ stock_quantity }, quantity) => ({
    stock_quantity: stock_quantity + quantity,
  }),

  'stock.reduce': ({ stock_quantity }, quantity) => {
    if (stock_quantity < quantity) {
      throw AppError.badRequest('Insufficient stock to reduce');
    }
    return { stock_quantity: stock_quantity - quantity };
  },

  'stock.reserve': ({ stock_quantity, reserved_quantity }, quantity) => {
    const available = stock_quantity - (reserved_quantity || 0);
    if (available < quantity) {
      throw AppError.badRequest('Insufficient available stock to reserve');
    }
    return { reserved_quantity: (reserved_quantity || 0) + quantity };
  },

  'reserved_stock.release': ({ reserved_quantity }, quantity) => {
    if ((reserved_quantity || 0) < quantity) {
      throw AppError.badRequest('Insufficient reserved stock to release');
    }
    return { reserved_quantity: (reserved_quantity || 0) - quantity };
  },

  'reserved_stock.confirm': (
    { stock_quantity, reserved_quantity },
    quantity
  ) => {
    if ((reserved_quantity || 0) < quantity) {
      throw AppError.badRequest('Insufficient reserved stock to confirm');
    }
    if (stock_quantity < quantity) {
      throw AppError.badRequest('Insufficient stock to confirm');
    }

    return {
      stock_quantity: stock_quantity - quantity,
      reserved_quantity: (reserved_quantity || 0) - quantity,
    };
  },
};

// Apply stock operation and persist changes
export const applyStockOperation = async (variant, operation, client) => {
  const { id: variantId, product_id: productId } = variant;
  let updateData;

  if (operation.operation === 'stock.set') {
    const { stock_quantity, reserved_quantity, reorder_level } = operation;
    updateData = Object.fromEntries(
      Object.entries({
        stock_quantity,
        reserved_quantity,
        reorder_level,
      }).filter(([, value]) => value !== undefined)
    );
  } else {
    const compute = computeStockDelta[operation.operation];
    if (!compute) {
      throw AppError.badRequest('Invalid stock operation');
    }
    updateData = compute(variant, operation.quantity);
  }

  return await ProdVariantsModel.update(
    productId,
    variantId,
    updateData,
    client
  );
};

// ==================== RESPONSE FORMATTERS ====================

// Unified response wrapper for single variant operations
const formatResponse = (variant) => ({
  success: true,
  message: 'Variant updated successfully',
  variant: {
    ...formatAdminVariant(variant),
    available_quantity:
      variant.stock_quantity - (variant.reserved_quantity || 0),
  },
});

// Shared Services:
export const findVariantById = async (variantId, client) => {
  const variant = await ProdVariantsModel.findById(variantId, client);
  return variant;
};
