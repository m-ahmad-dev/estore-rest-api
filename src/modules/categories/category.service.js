import executeTransaction from "../../core/utils/dbTransaction.js";
import AppError from "../../core/utils/error.utils.js";
import toSlug from "../../core/utils/slug.utils.js";
import { toHierarchicalTree } from "../../core/utils/structure.utils.js";
import CategoryModel from "./category.model.js";
import { isDescendant, getAncestors } from "./category.utils.js";
import util from "util";

export const create = async (body) => {
  return await executeTransaction(async (client) => {
    if (body.parent_id) {
      const parent = await CategoryModel.findById(body.parent_id, client);
      if (!parent) throw AppError.notFound("Parent category");
    }

    const slug = toSlug(body.name);
    const exist = await CategoryModel.findByNameOrSlug(body.name, slug, client);

    if (exist) {
      throw AppError.conflict(
        "Category already exists",
        `Category '${body.name}' (${slug}) already exists`,
      );
    }

    const data = {
      ...body,
      slug,
      parent_id: body.parent_id || null,
    };

    const category = await CategoryModel.insert(data, client);

    return {
      success: true,
      message: `Category '${category.name}' created successfully`,
      category,
    };
  });
};

export const getAll = async (query) => {
  const pages = Math.max(1, parseInt(query.pages) || 1); // Prevent 0 or negative
  const limit = Math.max(1, parseInt(query.limit) || 10);
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const sortBy = query.sort || "created_at";
  const orderBy = query.order || "asc";
  const skip = (pages - 1) * limit;

  // Validation Logic
  const allowedSortFields = ["name", "created_at"];
  if (!allowedSortFields.includes(sortBy)) {
    throw AppError.badRequest(
      `'sort' must be one of: ${allowedSortFields.join(", ")}`,
    );
  }

  const allowedOrders = ["asc", "desc"];
  if (!allowedOrders.includes(orderBy)) {
    throw AppError.badRequest(
      `'order' must be one of: ${allowedOrders.join(" or ")}`,
    );
  }

  const startTime = Date.now();

  // Data Retrieval
  const { categories, totalFilteredCount } =
    await CategoryModel.findAllWithPagination(
      search,
      skip,
      limit,
      sortBy,
      orderBy,
    );

  const totalPages = Math.ceil(totalFilteredCount / limit);

  return {
    success: true,
    message: "Data retrieved successfully",
    categories,
    pagination: {
      totalItems: totalFilteredCount,
      totalPages,
      currentPage: pages,
      itemsPerPage: limit,
    },
    meta: {
      search: search || null,
      queryTime: `${Date.now() - startTime}ms`,
      sortBy,
      orderBy,
    },
  };
};

export const getOne = async (id) => {
  const category = await CategoryModel.findById(id);
  if (!category) throw AppError.notFound("Category");

  return {
    success: true,
    message: "Data retrieved successfully",
    category,
  };
};

export const edit = async (categoryId, updates) => {
  return await executeTransaction(async (client) => {
    const category = await CategoryModel.findById(categoryId, client);
    if (!category) throw AppError.notFound("Category not found");

    const { parent_id, name } = updates;

    // Hierarchy Validation
    if (parent_id) {
      if (parent_id === categoryId) {
        throw AppError.badRequest("Category cannot be its own parent");
      }

      const hasCircularLink = await isDescendant(categoryId, parent_id, client);
      if (hasCircularLink) {
        throw AppError.badRequest(
          "Circular reference: New parent cannot be a descendant.",
        );
      }
    }

    const payload = {
      ...updates,
      ...(name && { slug: toSlug(name) }),
    };

    const updatedCategory = await CategoryModel.update(
      categoryId,
      payload,
      client,
    );

    return {
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    };
  });
};

export const remove = async (categoryId) => {
  return await executeTransaction(async (client) => {
    const category = await CategoryModel.findById(categoryId, client);
    if (!category) throw AppError.notFound("Category");

    await CategoryModel.delete(categoryId, client);
  });
};

export const getAllTree = async () => {
  const { categories } = await CategoryModel.findAllFlat();
  const data = toHierarchicalTree(categories);

  return {
    success: true,
    message: "Data retrieved successfully",
    categories: data,
  };
};

export const getWithDetail = async (slug) => {
  if (!slug || typeof slug !== "string" || slug.trim() === "") {
    throw AppError.badRequest(
      "Slug parameter is required",
      "Missing or invalid slug",
    );
  }

  return await executeTransaction(async (client) => {
    const category = await CategoryModel.findByNameOrSlug(
      undefined,
      slug,
      client,
    );
    if (!category) throw AppError.notFound("Category");

    // Build full ancestor chain
    const ancestors = category.parent_id
      ? await getAncestors(category.parent_id, client)
      : [];

    // Direct children of this category
    const children = await CategoryModel.findChild(category.id, client);

    return {
      success: true,
      message: "Data retrieved successfully",
      category: {
        ...category,
        ancestors,
        children,
        depth: ancestors.length,
      },
    };
  });
};

export const getRootParent = async () => {
  const categories = await CategoryModel.roots();
  return {
    success: true,
    message: "Data retrieved successfully",
    categories,
  };
};
