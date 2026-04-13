import AdminModel from "../models/admin.model.js";
import CustomerModel from "../models/customer.model.js";
import PermissionModel from "../models/permission.model.js";
import { loginService, logoutService } from "../utils/auth.utils.js";
import { sendError } from "../utils/error.utils.js";
import { tryCatch } from "../utils/trycatch.js";

// ADMIN AUTHENTICATION SERVICES

export const loginAdminService = tryCatch((email, password) => {
  return loginService({
    email,
    password,
    role: "admin",
    findUserByEmail: (email, client) => AdminModel.findByEmail(email, client),
    buildPayload: (admin) => ({
      id: admin.id,
      name: admin.name,
      role: admin.role,
    }),
    buildResponse: async (admin, client) => {
      const permissions = await PermissionModel.findPermissions(
        admin.id,
        client,
      );
      delete admin.password_hash;
      return { admin, permissions };
    },
  });
});

export const logoutAdminService = tryCatch(({ refreshToken, userId }) => {
  return logoutService({
    refreshToken,
    userId,
    findUserById: (id, client) => AdminModel.findById(id, client),
  });
});

// CUSTOMER AUTHENTICATION SERVICES

export const loginCustomerService = tryCatch(async (params) => {
  if (!params)
    throw sendError(
      "Make sure no required field is missing.",
      400,
      null,
      "MISSING_FIELD",
    );

  const { email, password } = params;

  return await loginService({
    email,
    password,
    role: "customer",

    findUserByEmail: (email, client) =>
      CustomerModel.findByEmail(email, client),

    buildPayload: (customer) => ({
      id: customer.id,
      name: `${customer.first_name} ${customer.last_name}`,
      role: "customer",
    }),

    buildResponse: async (customer) => {
      delete customer.password_hash;
      return { customer };
    },
  });
});

export const logoutCustomerService = tryCatch((params) => {
  const { refreshToken, userId } = params;
  return logoutService({
    refreshToken,
    userId,
    findUserById: (id, client) => CustomerModel.findById(id, client),
  });
});
