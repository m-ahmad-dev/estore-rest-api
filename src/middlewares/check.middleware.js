import AdminModel from "../models/admin.model.js";
import CustomerModel from "../models/customer.model.js";
import { isActive, isExist } from "../utils/middleware.utils.js";

export const isAdminActive = isActive(
  async (id) => await AdminModel.isActive(id),
);

export const isExistAdmin = isExist(
  async (id) => await AdminModel.findById(id),
);
export const isCustomerActive = isActive(
  async (id) => await CustomerModel.isActive(id),
);

export const isCustomerExist = isExist(
  async (id) => await CustomerModel.findById(id),
);
