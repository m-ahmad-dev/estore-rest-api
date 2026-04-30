import prisma from "../../core/configs/db.js";

const CATEGORY_SELECT_FIELDS = {
  id: true,
  parent_id: true,
  name: true,
  slug: true,
  description: true,
  is_active: true,
  created_at: true,
};

const CategoryModel = {
  insert: async (data, db = prisma) => {
    return await db.categories.create({
      data,
      select: CATEGORY_SELECT_FIELDS,
    });
  },

  findById: async (id, db = prisma) => {
    return await db.categories.findUnique({
      where: { id },
      select: {
        ...CATEGORY_SELECT_FIELDS,
        _count: { select: { products: true } },
      },
    });
  },

  findByNameOrSlug: async (name, slug, db = prisma) => {
    return await db.categories.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
      select: CATEGORY_SELECT_FIELDS,
    });
  },

  findAll: async (search, skip, limit, sortBy, sortOrder, db = prisma) => {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [categories, totalFilteredCount] = await Promise.all([
      db.categories.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          ...CATEGORY_SELECT_FIELDS,
          _count: { select: { products: true } },
        },
      }),
      db.categories.count({ where }),
    ]);

    return { categories, totalFilteredCount };
  },

  findChild: async (parent_id, db = prisma) => {
    return await db.categories.findMany({
      where: { parent_id },
      select: CATEGORY_SELECT_FIELDS,
    });
  },

  update: async (categoryId, data, db = prisma) => {
    return await db.categories.update({
      where: { id: categoryId },
      data,
      select: CATEGORY_SELECT_FIELDS,
    });
  },

  delete: async (categoryId, db = prisma) => {
    return await db.categories.delete({
      where: { id: categoryId },
    });
  },
};

export default CategoryModel;
