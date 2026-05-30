import prisma from '../../../core/configs/db.js';

const IMAGE_SELECT_FIELDS = {
  id: true,
  product_id: true,
  key: true,
  url: true,
  alt_text: true,
  is_primary: true,
  sort_order: true,
  created_at: true,
};

const ProdImagesModel = {
  // Find image by ID:
  findById: async (productId, imageId, db = prisma) => {
    return db.product_images.findUnique({
      where: { id: imageId, product_id: productId },
      select: IMAGE_SELECT_FIELDS,
    });
  },

  // Find image by ID and Product ID (ownership check):
  findByIdAndProduct: async (productId, imageId, db = prisma) => {
    return db.product_images.findFirst({
      where: {
        id: imageId,
        product_id: productId,
      },
      select: IMAGE_SELECT_FIELDS,
    });
  },

  // Get all images for a product with proper ordering:
  findByProductId: async (productId, db = prisma) => {
    return db.product_images.findMany({
      where: { product_id: productId },
      select: IMAGE_SELECT_FIELDS,
      orderBy: [
        { is_primary: 'desc' },
        { sort_order: 'asc' },
        { created_at: 'asc' },
      ],
    });
  },

  findPrimary: async (productId, db = prisma) => {
    return db.product_images.findFirst({
      where: { product_id: productId, is_primary: true },
      select: IMAGE_SELECT_FIELDS,
    });
  },

  findKeys: async (productId, keys, db = prisma) => {
    if (!keys?.length) return [];
    const rows = await db.product_images.findMany({
      where: {
        product_id: productId,
        key: { in: keys },
      },
      select: { key: true },
    });
    return rows.map((r) => r.key);
  },

  getMaxSortOrder: async (productId, db = prisma) => {
    const result = await db.product_images.aggregate({
      where: { product_id: productId },
      _max: { sort_order: true },
    });
    return result._max.sort_order ?? 0;
  },

  clearPrimary: async (productId, excludeImageId = null, db = prisma) => {
    return db.product_images.updateMany({
      where: {
        product_id: productId,
        is_primary: true,
        ...(excludeImageId && { NOT: { id: excludeImageId } }),
      },
      data: { is_primary: false },
    });
  },

  setPrimary: async (imageId, db = prisma) => {
    return db.product_images.update({
      where: { id: imageId },
      data: { is_primary: true },
      select: IMAGE_SELECT_FIELDS,
    });
  },

  insertMany: async (productId, images, db = prisma) => {
    const data = images.map((img) => ({
      product_id: productId,
      key: img.key,
      url: img.url,
      alt_text: img.alt_text,
      is_primary: img.is_primary,
      sort_order: img.sort_order,
    }));

    return db.product_images.createManyAndReturn({
      data,
      skipDuplicates: false,
      select: IMAGE_SELECT_FIELDS,
    });
  },

  update: async (imageId, data, db = prisma) => {
    return db.product_images.update({
      where: { id: imageId },
      data,
      select: IMAGE_SELECT_FIELDS,
    });
  },

  updateSortOrdersBulk: async (imageIds, sortMap, db = prisma) => {
    if (!imageIds?.length) return;

    const newOrders = imageIds.map((id) => sortMap.get(id));

    await db.$executeRaw`
      UPDATE product_images AS p
      SET sort_order = u.new_order
      FROM UNNEST(${imageIds}::uuid[], ${newOrders}::int[]) AS u(id, new_order)
      WHERE p.id = u.id;
    `;
  },

  delete: async (imageId, db = prisma) => {
    return db.product_images.delete({
      where: { id: imageId },
      select: {
        id: true,
        product_id: true,
        is_primary: true,
        key: true, // kept for potential future S3 cleanup
      },
    });
  },

  deleteByProduct: async (productId, db = prisma) => {
    return db.product_images.deleteMany({
      where: { product_id: productId },
    });
  },
};

export default ProdImagesModel;
