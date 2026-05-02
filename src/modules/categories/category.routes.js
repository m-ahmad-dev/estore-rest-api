import express from "express";
import auth from "../../core/middlewares/auth.middleware.js";
import validate from "../../core/middlewares/input_validate.middleware.js";
import authorizePermissions from "../../core/middlewares/pbac.middleware.js";
import validateUUID from "../../core/middlewares/valid_uuid.middleware.js";
import { isAdminActive } from "../../core/middlewares/check.middleware.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "./category.validation.js";
import {
  createCategory,
  getAllCategoriesFlat,
  getAllCategoriesTree,
  getCategoryDetail,
  getRootCategories,
  getSingleCategory,
  removeCategory,
  updateCategory,
} from "./category.controller.js";
const categoryRoutes = express.Router();

categoryRoutes.get("/categories", getAllCategoriesTree);
categoryRoutes.get("/categories/:slug/details", getCategoryDetail);
categoryRoutes.get("/categories/roots", getRootCategories);

categoryRoutes.use("/admin/categories", auth);
categoryRoutes.use("/admin/categories", isAdminActive);
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

export default categoryRoutes;
