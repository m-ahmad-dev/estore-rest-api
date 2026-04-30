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
  getAllCategories,
  getSingleCategory,
  removeCategory,
  updateCategory,
} from "./category.controller.js";
const categoryRoutes = express.Router();

categoryRoutes.use(auth);

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
  getAllCategories,
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
