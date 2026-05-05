import prisma from "../../core/configs/db.js";

const CATEGORY_SELECT_FIELDS = {
  id: true,
  parent_id: true,
  name: true,
  slug: true,
  description: true,
  is_active: true,
  attribute_rules: true,
  created_at: true,
  updated_at: true,
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

  // Looks up a category by name, slug, or both.
  // Used for duplicate detection — pass only the fields you want to check.
  findByNameOrSlug: async (name, slug, db = prisma) => {
    const filters = [];
    if (name) filters.push({ name });
    if (slug) filters.push({ slug });
    if (!filters.length) return null;

    return await db.categories.findFirst({
      where: { OR: filters },
      select: CATEGORY_SELECT_FIELDS,
    });
  },

  findAllWithPagination: async (
    search,
    skip,
    limit,
    sortBy,
    sortOrder,
    db = prisma,
  ) => {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
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

  // Used by the public tree endpoint — toHierarchicalTree() does the nesting.
  findAllFlat: async (db = prisma) => {
    return await db.categories.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: {
        ...CATEGORY_SELECT_FIELDS,
        _count: { select: { products: true } },
      },
    });
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

  roots: async (db = prisma) => {
    return await db.categories.findMany({
      where: { parent_id: null, is_active: true },
      orderBy: { name: "asc" },
      select: {
        ...CATEGORY_SELECT_FIELDS,
        _count: { select: { products: true } },
      },
    });
  },
};

export default CategoryModel;
