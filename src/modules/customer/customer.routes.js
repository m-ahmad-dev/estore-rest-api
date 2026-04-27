import express from "express";
import { updateProfileSchema } from "./customers.validations.js";
import auth from "../../core/middlewares/auth.middleware.js";
import validate from "../../core/middlewares/input_validate.middleware.js";
import validateUUID from "../../core/middlewares/valid_uuid.middleware.js";
import authorizePermission from "../../core/middlewares/pbac.middleware.js";
import {
  isCustomerActive,
  isAdminActive,
  isCustomerExist,
} from "../../core/middlewares/check.middleware.js";
import {
  changeCustomerStatus,
  deleteAccount,
  editCustomerProfile,
  getAllCustomers,
  getCustomerByID,
  getMyProfile,
  updateMyProfile,
} from "./customer.controller.js";

const customerRoutes = express.Router();

customerRoutes.use(auth);

customerRoutes.get("/customers/me", isCustomerActive, getMyProfile);
customerRoutes.patch(
  "/customers/me",
  isCustomerActive,
  validate(updateProfileSchema),
  updateMyProfile,
);
customerRoutes.delete("/customers/me", isCustomerActive, deleteAccount);

// Admin access for customer management
customerRoutes.use(isAdminActive);
customerRoutes.get(
  "/admin/customers",
  authorizePermission("customers.view"),
  getAllCustomers,
);
customerRoutes.get(
  "/admin/customers/:id",
  validateUUID,
  authorizePermission("customers.view"),
  isCustomerExist,
  getCustomerByID,
);
customerRoutes.patch(
  "/admin/customers/:id",
  validateUUID,
  authorizePermission("customers.edit"),
  validate(updateProfileSchema),
  isCustomerExist,
  editCustomerProfile,
);
customerRoutes.patch(
  "/admin/customers/:id/status",
  validateUUID,
  authorizePermission("customers.update_status"),
  isCustomerExist,
  changeCustomerStatus,
);

export default customerRoutes;
