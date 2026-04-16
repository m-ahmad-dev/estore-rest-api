import AdminModel from "../models/admin.model.js";
import CustomerModel from "../models/customer.model.js";
import OAuthModel from "../models/oauth.model.js";
import PermissionModel from "../models/permission.model.js";
import TokenModel from "../models/token.model.js";
import { loginService, logoutService } from "../utils/auth.utils.js";
import { toHash } from "../utils/bcrypt.utils.js";
import executeTransaction from "../utils/dbTransaction.js";
import { AppError } from "../utils/error.utils.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwtoken.utils.js";
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
  const { email, password } = params;

  return await loginService({
    email,
    password,
    role: "customer",

    findUserByEmail: (email, client) =>
      CustomerModel.findByEmail(email, client),

    buildPayload: (customer) => ({
      id: customer.id,
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

// GOOGLE OAUTH SERVICES

export const handleGoogleAuthService = async (profile) => {
  const { googleId, email, firstname, lastname, provider } = profile;

  return await executeTransaction(async (client) => {
    const authProvider = await OAuthModel.findByProviderId(
      provider,
      googleId,
      client,
    );

    let customer;

    if (authProvider) {
      customer = await CustomerModel.findById(authProvider.customer_id, client);
    } else {
      customer = await CustomerModel.findByEmail(email, client);

      if (customer) {
        await OAuthModel.create(customer.id, provider, googleId, client);
      } else {
        customer = await CustomerModel.create(
          firstname,
          lastname,
          email,
          client,
        );
        await OAuthModel.create(customer.id, provider, googleId, client);
      }
    }

    if (!customer.is_active) {
      throw AppError.forbidden("Your account is disabled");
    }

    const payload = { id: customer.id, role: "customer" };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const hashrefreshToken = await toHash(refreshToken);

    await TokenModel.insert(customer.id, hashrefreshToken, "customer", client);

    return { accessToken, refreshToken };
  });
};
