import express from "express";
import auth from "../../core/middlewares/auth.middleware.js";
import validate from "../../core/middlewares/input_validate.middleware.js";
import validateUUID from "../../core/middlewares/valid_uuid.middleware.js";
import authorizePermission from "../../core/middlewares/pbac.middleware.js";
import {
  createAddressSchema,
  updateAddressSchema,
} from "./address.validation.js";
import {
  isAdminActive,
  isCustomerActive,
  isCustomerExist,
} from "../../core/middlewares/check.middleware.js";
import {
  createAddress,
  getAllAddresses,
  getCustomerAddresses,
  getSingleAddress,
  removeAddress,
  updateAddress,
} from "./address.controller.js";

const addressRoutes = express.Router();

addressRoutes.use("/addresses", auth);
addressRoutes.use("/addresses", isCustomerActive);

addressRoutes.post("/addresses", validate(createAddressSchema), createAddress);
addressRoutes.get("/addresses", getAllAddresses);
addressRoutes.get("/addresses/:id", validateUUID, getSingleAddress);
addressRoutes.patch(
  "/addresses/:id",
  validateUUID,
  validate(updateAddressSchema),
  updateAddress,
);
addressRoutes.delete("/addresses/:id", validateUUID, removeAddress);

// Admin access routes.
addressRoutes.get(
  "/admin/customers/:id/addresses",
  auth,
  isAdminActive,
  authorizePermission("customers.view"),
  validateUUID,
  isCustomerExist,
  getCustomerAddresses,
);

export default addressRoutes;
