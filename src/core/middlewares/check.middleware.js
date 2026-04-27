import { isActive, isExist } from "../utils/middleware.utils.js";
import {
  checkCustomerExist,
  checkCustomerStatus,
} from "../../modules/customer/customer.service.js";
import {
  checkAdminExist,
  checkAdminStatus,
} from "../../modules/admin/admin.service.js";

export const isAdminActive = isActive(async (id) => await checkAdminStatus(id));

export const isExistAdmin = isExist(async (id) => await checkAdminExist(id));

export const isCustomerActive = isActive(
  async (id) => await checkCustomerStatus(id),
);

export const isCustomerExist = isExist(
  async (id) => await checkCustomerExist(id),
);
