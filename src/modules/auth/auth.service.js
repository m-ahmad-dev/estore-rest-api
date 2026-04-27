import OAuthModel from "./oauth.model.js";
import PasswordReset from "./password_reset.model.js";
import { loginService, logoutService } from "./auth.utils.js";
import { compareHash, toHash } from "../../core/utils/bcrypt.utils.js";
import executeTransaction from "../../core/utils/dbTransaction.js";
import AppError from "../../core/utils/error.utils.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../core/utils/jwtoken.utils.js";
import { tryCatch } from "../../core/utils/trycatch.js";
import crypto from "crypto";
import EmailService from "./email.service.js";
import { findAdminByEmail, findAdminById } from "../admin/admin.service.js";
import { adminPermissions } from "../permissions/permissions.service.js";
import {
  findCustomerByEmail,
  findCustomerById,
  insertCustomer,
  updateCustomerPassword,
} from "../customer/customer.service.js";
import { createSession } from "../token/token.service.js";

// ADMIN AUTHENTICATION SERVICES

export const loginAdminService = tryCatch((email, password) => {
  return loginService({
    email,
    password,
    role: "admin",
    findUserByEmail: (email, client) => findAdminByEmail(email, client),
    buildPayload: (admin) => ({
      id: admin.id,
      role: admin.role,
    }),
    buildResponse: async (admin, client) => {
      const permissions = await adminPermissions(admin.id, client);
      delete admin.password_hash;
      return { admin, permissions };
    },
  });
});

export const logoutAdminService = tryCatch(({ refreshToken, userId }) => {
  return logoutService({
    refreshToken,
    userId,
    findUserById: (id, client) => findAdminById(id, client),
  });
});

// CUSTOMER AUTHENTICATION SERVICES

export const loginCustomerService = tryCatch(async (params) => {
  const { email, password } = params;

  return await loginService({
    email,
    password,
    role: "customer",

    findUserByEmail: (email, client) => findCustomerByEmail(email, client),

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
    findUserById: (id, client) => findCustomerById(id, client),
  });
});

export const forgotPasswordServices = async (req) => {
  if (!req || !req.email) {
    throw AppError.validationError([
      { field: "email", message: "Email is required" },
    ]);
  }

  const { email } = req;
  let token = null;
  let customer = null;

  await executeTransaction(async (client) => {
    customer = await findCustomerByEmail(email, client);

    if (!customer) return; // prevent email enumeration

    token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await PasswordReset.insert(
      customer.id,
      tokenHash,
      new Date(Date.now() + 15 * 60 * 1000),
      client,
    );
  });

  if (customer && token) {
    await EmailService.sendPasswordResetEmail({
      to: customer.email,
      token,
    });
  }
};

export const resetPasswordServices = async (params) => {
  const errors = [
    !params.token && { field: "token", message: "Token is required" },
    !params.newPassword && {
      field: "newPassword",
      message: "Password is required",
    },
  ].filter(Boolean);

  if (errors.length) throw AppError.validationError(errors);

  const { token, newPassword } = params;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await executeTransaction(async (client) => {
    const record = await PasswordReset.findByToken(tokenHash, client);

    if (!record || record.used || record.expires_at < new Date()) {
      throw AppError.unauthorized("Invalid or expired reset token");
    }

    const passwordHash = await toHash(newPassword);

    await updateCustomerPassword(record.customer_id, passwordHash, client);
    await PasswordReset.setAsUsed(record.id, client);
  });
};

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
      customer = await findCustomerById(authProvider.customer_id, client);
    } else {
      customer = await findCustomerByEmail(email, client);

      if (customer) {
        await OAuthModel.create(customer.id, provider, googleId, client);
      } else {
        customer = await insertCustomer(
          firstname,
          lastname,
          email,
          null,
          null,
          client,
        );
        await OAuthModel.create(customer.id, provider, googleId, client);
      }
    }

    if (!customer.is_active)
      throw AppError.forbidden("Your account is disabled");

    const payload = { id: customer.id, role: "customer" };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const hashrefreshToken = await toHash(refreshToken);

    await createSession(customer.id, hashrefreshToken, "customer", client);

    return { accessToken, refreshToken };
  });
};
