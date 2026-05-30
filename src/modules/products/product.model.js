// models/product.model.js
import prisma from '../../core/configs/db.js';

const PRODUCT_BASE_SELECT = {
  id: true,
  category_id: true,
  name: true,
  slug: true,
  description: true,
  base_price: true,
  is_active: true,
  created_at: true,
  deleted_at: true,
};

const ProductModel = {
  // ====== Create ======
  create: async (data, db = prisma) => {
    return await db.products.create({
      data: {
        name: data.name,
        slug: data.slug,
        category_id: data.category_id,
        base_price: data.base_price,
        description: data.description ?? null,
        is_active: data.is_active ?? true,
      },
      select: {
        ...PRODUCT_BASE_SELECT,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            attribute_rules: true,
          },
        },
      },
    });
  },

  // ====== Read ======
  findById: async (id, db = prisma) => {
    return await db.products.findUnique({
      where: { id },
      select: {
        ...PRODUCT_BASE_SELECT,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            parent_id: true,
            is_active: true,
            attribute_rules: true,
          },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            attributes: true,
            price: true,
            stock_quantity: true,
            reserved_quantity: true,
            reorder_level: true,
            deleted_at: true,
          },
          orderBy: { price: 'asc' },
        },
        images: {
          select: {
            id: true,
            key: true,
            url: true,
            alt_text: true,
            is_primary: true,
            sort_order: true,
          },
          orderBy: { sort_order: 'asc' },
        },
        _count: {
          select: { reviews: true },
        },
      },
    });
  },

  findBySlug: async (slug, db = prisma) => {
    return await db.products.findFirst({
      where: { slug, deleted_at: null, is_active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        base_price: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        variants: {
          select: {
            id: true,
            attributes: true,
            price: true,
            stock_quantity: true,
            reserved_quantity: true,
          },
          where: { deleted_at: null },
          orderBy: { price: 'asc' },
        },
        images: {
          select: {
            id: true,
            url: true,
            alt_text: true,
            is_primary: true,
          },
          orderBy: { sort_order: 'asc' },
        },
        _count: {
          select: { reviews: true },
        },
      },
    });
  },

  findMany: async (where, orderBy, limit, cursor, db = prisma) => {
    return await db.products.findMany({
      where,
      orderBy,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        base_price: true,
        is_active: true,
        deleted_at: true,
        created_at: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          where: { is_primary: true },
          select: { id: true, key: true, url: true, is_primary: true },
          orderBy: { sort_order: 'asc' },
          take: 1,
        },
        _count: { select: { reviews: true } },
      },
    });
  },

  // ====== Update ======
  update: async (id, data, db = prisma) => {
    return await db.products.update({
      where: { id },
      data,
      select: {
        ...PRODUCT_BASE_SELECT,
        category: {
          select: { id: true, name: true },
        },
      },
    });
  },

  // ====== Delete ======
  softDelete: async (id, db = prisma) => {
    return await db.products.update({
      where: { id },
      data: { deleted_at: new Date() },
      select: { id: true, deleted_at: true },
    });
  },

  hardDelete: async (id, db = prisma) => {
    return await db.products.delete({
      where: { id },
      select: { id: true },
    });
  },

  // ====== Utility ======
  exists: async (id, db = prisma) => {
    const product = await db.products.findUnique({
      where: { id },
      select: { id: true, deleted_at: true },
    });

    return {
      exists: !!product,
      deleted: !!product?.deleted_at,
    };
  },

  isSlugAvailable: async (slug, excludeId = null, db = prisma) => {
    const count = await db.products.count({
      where: {
        slug,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return count === 0;
  },
};

export default ProductModel;
