import express from "express";
import auth from "../../core/middlewares/auth.middleware.js";
import validate from "../../core/middlewares/input_validate.middleware.js";
import authorizePermissions from "../../core/middlewares/pbac.middleware.js";
import validateUUID from "../../core/middlewares/valid_uuid.middleware.js";
import { isAdminActive } from "../../core/middlewares/check.middleware.js";
import {
  createCategorySchema,
  updateCategorySchema,
  attributeRuleSchema,
  updateAttributeRuleSchema,
} from "./category.validation.js";
import {
  addAttribute,
  createCategory,
  getAllCategoriesFlat,
  getAllCategoriesTree,
  getCategoryAttributes,
  getCategoryDetail,
  getRootCategories,
  getSingleCategory,
  removeAttribute,
  removeCategory,
  updateAttribute,
  updateCategory,
} from "./category.controller.js";

const categoryRoutes = express.Router();

// ─── Public routes ────
categoryRoutes.get("/categories", getAllCategoriesTree);
categoryRoutes.get("/categories/roots", getRootCategories);
categoryRoutes.get("/categories/:slug/details", getCategoryDetail);

// ─── Admin middleware ────
categoryRoutes.use("/admin/categories", auth);
categoryRoutes.use("/admin/categories", isAdminActive);

// ─── Admin CRUD ─────
categoryRoutes.post(
  "/admin/categories",
  authorizePermissions("categories.create"),
  validate(createCategorySchema),
  createCategory,
);

categoryRoutes.get(
  "/admin/categories",
  authorizePermissions("categories.view"),
  getAllCategoriesFlat,
);

categoryRoutes.get(
  "/admin/categories/:id",
  validateUUID,
  authorizePermissions("categories.view"),
  getSingleCategory,
);

categoryRoutes.patch(
  "/admin/categories/:id",
  validateUUID,
  authorizePermissions("categories.edit"),
  validate(updateCategorySchema),
  updateCategory,
);

categoryRoutes.delete(
  "/admin/categories/:id",
  validateUUID,
  authorizePermissions("categories.delete"),
  removeCategory,
);

// ─── Admin - granular attribute management ───
categoryRoutes.get(
  "/admin/categories/:id/attributes",
  validateUUID,
  authorizePermissions("categories.view"),
  getCategoryAttributes,
);

categoryRoutes.post(
  "/admin/categories/:id/attributes",
  validateUUID,
  authorizePermissions("categories.edit"),
  validate(attributeRuleSchema),
  addAttribute,
);

categoryRoutes.patch(
  "/admin/categories/:id/attributes/:attrName",
  validateUUID,
  authorizePermissions("categories.edit"),
  validate(updateAttributeRuleSchema),
  updateAttribute,
);

categoryRoutes.delete(
  "/admin/categories/:id/attributes/:attrName",
  validateUUID,
  authorizePermissions("categories.edit"),
  removeAttribute,
);

export default categoryRoutes;
