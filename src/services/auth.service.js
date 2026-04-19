import AdminModel from "../models/admin.model.js";
import CustomerModel from "../models/customer.model.js";
import OAuthModel from "../models/oauth.model.js";
import PasswordReset from "../models/passwordreset.model.js";
import PermissionModel from "../models/permission.model.js";
import TokenModel from "../models/token.model.js";
import { loginService, logoutService } from "../utils/auth.utils.js";
import { compareHash, toHash } from "../utils/bcrypt.utils.js";
import executeTransaction from "../utils/dbTransaction.js";
import { AppError } from "../utils/error.utils.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwtoken.utils.js";
import { tryCatch } from "../utils/trycatch.js";
import crypto from "crypto";
import EmailService from "./email.service.js";

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
    customer = await CustomerModel.findByEmail(email, client);

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

    await CustomerModel.updatePassword(
      record.customer_id,
      passwordHash,
      client,
    );

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
          null,
          null,
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
