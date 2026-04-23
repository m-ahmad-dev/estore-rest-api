import express from "express";
import { updateProfileSchema } from "../validations/customers.validations.js";
import auth from "../middlewares/auth.middleware.js";
import validate from "../middlewares/input_validate.middleware.js";
import {
  isCustomerActive,
  isCustomerExist,
} from "../middlewares/check.middleware.js";
import authorizePermission from "../middlewares/pbac.middleware.js";
import validateUUID from "../middlewares/valid_uuid.middleware.js";
import {
  deleteAccount,
  getAllCustomers,
  getCustomerByID,
  getMyProfile,
  changeCustomerStatus,
  updateMyProfile,
  editCustomerProfile,
} from "../controllers/customer.controller.js";

const customerRoutes = express.Router();

customerRoutes.use(auth);
// Admins protected routes
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

customerRoutes.use(isCustomerActive);
customerRoutes.get("/customers/me", getMyProfile);
customerRoutes.patch(
  "/customers/me",
  validate(updateProfileSchema),
  updateMyProfile,
);
customerRoutes.delete("/customers/me", deleteAccount);

export default customerRoutes;
