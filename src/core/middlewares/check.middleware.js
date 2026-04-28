import { isActive, isExist } from "../utils/middleware.utils.js";
import {
  checkCustomerExist,
  checkCustomerStatus,
} from "../../modules/customer/customer.service.js";
import {
  checkAdminExist,
  checkAdminStatus,
} from "../../modules/admin/admin.service.js";

export const isAdminActive = isActive(checkAdminStatus);

export const isExistAdmin = isExist(checkAdminExist);

export const isCustomerActive = isActive(checkCustomerStatus);

export const isCustomerExist = isExist(checkCustomerExist);
