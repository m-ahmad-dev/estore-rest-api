import executeTransaction from "../../core/utils/dbTransaction.js";
import AppError from "../../core/utils/error.utils.js";
import toSlug from "../../core/utils/slug.utils.js";
import { toHierarchicalTree } from "../../core/utils/structure.utils.js";
import CategoryModel from "./category.model.js";
import {
  isDescendant,
  getAncestors,
  getInheritedAttributes,
  checkInUse,
} from "./category.utils.js";

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
      attribute_rules: body.attribute_rules || [],
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
  const pages = Math.max(1, parseInt(query.pages) || 1);
  const limit = Math.max(1, parseInt(query.limit) || 10);
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const sortBy = query.sort || "created_at";
  const orderBy = query.order || "asc";
  const skip = (pages - 1) * limit;

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

  const startTime = process.hrtime.bigint();
  const { categories, totalFilteredCount } =
    await CategoryModel.findAllWithPagination(
      search,
      skip,
      limit,
      sortBy,
      orderBy,
    );

  const queryTimeMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
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
      queryTime: `${queryTimeMs.toFixed(2)}ms`,
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
    if (!category) throw AppError.notFound("Category");

    const { parent_id, name } = updates;

    // Hierarchy validation
    if (parent_id) {
      if (parent_id === categoryId) {
        throw AppError.badRequest("Category cannot be its own parent");
      }

      const hasCircularLink = await isDescendant(categoryId, parent_id, client);
      if (hasCircularLink) {
        throw AppError.badRequest(
          "Circular reference: new parent cannot be a descendant of this category.",
        );
      }
    }

    // Name / slug uniqueness check — guards both name and derived slug
    if (name) {
      const newSlug = toSlug(name);
      const existing = await CategoryModel.findByNameOrSlug(
        name,
        newSlug,
        client,
      );
      if (existing && existing.id !== categoryId) {
        throw AppError.conflict(
          "Category already exists",
          `A category named '${name}' or with slug '${newSlug}' already exists`,
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

    const childCategories = await CategoryModel.findChild(categoryId, client);
    if (childCategories.length > 0) {
      throw AppError.badRequest(
        "Cannot delete category with child categories. Remove or reassign child categories first.",
      );
    }

    const productExists = await checkInUse(categoryId, client);
    if (productExists) {
      throw AppError.badRequest(
        "Cannot delete category with products assigned. Remove or reassign products first.",
      );
    }

    await CategoryModel.delete(categoryId, client);
  });
};

export const getAllTree = async () => {
  const categories = await CategoryModel.findAllFlat();
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

    const ancestors = category.parent_id
      ? await getAncestors(category.parent_id, client)
      : [];
    const children = await CategoryModel.findChild(category.id, client);

    // Full inherited schema so the frontend knows what this category requires
    const inherited_attributes = await getInheritedAttributes(
      category.id,
      client,
    );

    return {
      success: true,
      message: "Data retrieved successfully",
      category: {
        ...category,
        ancestors,
        children,
        depth: ancestors.length,
        inherited_attributes,
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

export const getAttributes = async (categoryId) => {
  return await executeTransaction(async (client) => {
    const category = await CategoryModel.findById(categoryId, client);
    if (!category) throw AppError.notFound("Category");

    const attributes = await getInheritedAttributes(categoryId, client);

    return {
      success: true,
      message: "Attributes retrieved successfully",
      attributes,
    };
  });
};

export const addAttributeToCategory = async (categoryId, newAttr) => {
  return await executeTransaction(async (client) => {
    const category = await CategoryModel.findById(categoryId, client);
    if (!category) throw AppError.notFound("Category");

    const rules = Array.isArray(category.attribute_rules)
      ? category.attribute_rules
      : [];

    if (rules.some((r) => r.name === newAttr.name)) {
      throw AppError.conflict(
        "Attribute already exists",
        `Attribute '${newAttr.name}' already exists in this category.`,
      );
    }

    const updatedRules = [...rules, newAttr];
    const data = await CategoryModel.update(
      categoryId,
      { attribute_rules: updatedRules },
      client,
    );

    return { success: true, message: "Attribute added", data };
  });
};

export const updateAttributeInCategory = async (
  categoryId,
  attrName,
  updates,
) => {
  return await executeTransaction(async (client) => {
    const category = await CategoryModel.findById(categoryId, client);
    if (!category) throw AppError.notFound("Category");

    const rules = [...(category.attribute_rules || [])];
    const index = rules.findIndex((r) => r.name === attrName);
    if (index === -1) throw AppError.notFound("Attribute rule");

    // SECURITY: name/type changes break existing product variant data.
    // Only label, required, and options may be updated when products exist.
    const productExists = await checkInUse(categoryId, client);
    if (productExists && (updates.name || updates.type)) {
      throw AppError.badRequest(
        "Cannot change attribute name or type while products are assigned to this category.",
      );
    }

    rules[index] = { ...rules[index], ...updates };

    const data = await CategoryModel.update(
      categoryId,
      { attribute_rules: rules },
      client,
    );

    return { success: true, message: "Attribute updated", data };
  });
};

export const deleteAttributeFromCategory = async (categoryId, attrName) => {
  return await executeTransaction(async (client) => {
    const category = await CategoryModel.findById(categoryId, client);
    if (!category) throw AppError.notFound("Category");

    const rules = category.attribute_rules || [];

    const attrExists = rules.some((r) => r.name === attrName);
    if (!attrExists) throw AppError.notFound("Attribute");

    // SECURITY: Prevent deletion when products are linked
    const productExists = await checkInUse(categoryId, client);
    if (productExists) {
      throw AppError.badRequest(
        "Cannot delete attribute while products are assigned to this category. Remove or reassign products first.",
      );
    }

    const filteredRules = rules.filter((r) => r.name !== attrName);
    const data = await CategoryModel.update(
      categoryId,
      { attribute_rules: filteredRules },
      client,
    );

    return { success: true, message: "Attribute removed", data };
  });
};
