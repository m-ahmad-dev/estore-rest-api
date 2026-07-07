import prisma from '../../../core/configs/db.js';

const VARIANT_SELECT_FIELDS = {
  id: true,
  product_id: true,
  sku: true,
  weight: true,
  price: true,
  attributes: true,
  stock_quantity: true,
  reserved_quantity: true,
  reorder_level: true,
  deleted_at: true,
  attributes_hash: true, // useful for uniqueness
};

const VariantModel = {
  createMany: async (productId, preparedVariants, db = prisma) => {
    const data = preparedVariants.map((v) => ({
      product_id: productId,
      sku: v.sku,
      attributes: v.attributes,
      attributes_hash: v.attributes_hash,
      price: v.price,
      stock_quantity: v.stock_quantity ?? 0,
      reserved_quantity: v.reserved_quantity ?? 0,
      reorder_level: v.reorder_level ?? 10,
    }));

    return db.product_variants.createManyAndReturn({
      data,
      skipDuplicates: false,
      select: VARIANT_SELECT_FIELDS,
    });
  },

  findById: async (variantId, db = prisma) =>
    db.product_variants.findUnique({
      where: { id: variantId },
      select: VARIANT_SELECT_FIELDS,
    }),

  findBySKU: async (sku, db = prisma) =>
    db.product_variants.findUnique({
      where: { sku },
      select: VARIANT_SELECT_FIELDS,
    }),

  findByProductId: async (
    productId,
    includeDeleted = false,
    db = prisma
  ) =>
    db.product_variants.findMany({
      where: {
        product_id: productId,
        ...(includeDeleted ? {} : { deleted_at: null }),
      },
      select: VARIANT_SELECT_FIELDS,
      orderBy: { sku: 'asc' },
    }),

  findManyByIds: (variantsId, db = prisma) => {
    return db.product_variants.findMany({
      where: {
        id: { in: variantsId },
      },
      select: VARIANT_SELECT_FIELDS,
    });
  },

  update: async (productId, variantId, data, db = prisma) =>
    db.product_variants.update({
      where: { id: variantId, product_id: productId },
      data,
      select: VARIANT_SELECT_FIELDS,
    }),

  softDeleteOrRestore: async (
    productId,
    variantId,
    deletedAt = null,
    db = prisma
  ) =>
    db.product_variants.update({
      where: { id: variantId, product_id: productId },
      data: { deleted_at: deletedAt },
      select: { id: true, deleted_at: true },
    }),

  deleteAllByProduct: async (productId, db = prisma) =>
    db.product_variants.deleteMany({
      where: { product_id: productId },
    }),

  exists: async (variantId, db = prisma) => {
    const count = await db.product_variants.count({
      where: { id: variantId },
    });
    return count > 0;
  },

  countByProduct: async (productId, db = prisma) =>
    db.product_variants.count({ where: { product_id: productId } }),

  decrementStockAndReservation: async (id, quantity, db = prisma) => {
    return await db.product_variants.update({
      where: { id },
      data: {
        reserved_quantity: { decrement: quantity },
        stock_quantity: { decrement: quantity },
      },
    });
  },

  releaseReservedStock: async (id, quantity, db = prisma) => {
    return await db.product_variants.update({
      where: { id },
      data: {
        reserved_quantity: { decrement: quantity },
      },
    });
  },

  restoreStock: async (variantId, quantity, db = prisma) => {
    return await db.product_variants.update({
      where: { id: variantId },
      data: {
        stock_quantity: { increment: quantity },
      },
    });
  },
};

export default VariantModel;
