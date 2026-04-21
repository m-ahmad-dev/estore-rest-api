import CustomerModel from "../models/customer.model.js";
import TokenModel from "../models/token.model.js";
import { toHash } from "../utils/bcrypt.utils.js";
import executeTransaction from "../utils/dbTransaction.js";
import { AppError } from "../utils/error.utils.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwtoken.utils.js";
import { tryCatch } from "../utils/trycatch.js";

// CUSTOMER MANAGEMENT SERVICES

export const registerCustomerService = tryCatch(async (params) => {
  const { firstname, lastname, email, password, phone } = params;

  // Validation
  const errors = [
    !firstname && { field: "firstname", message: "Firstname is required" },
    !lastname && { field: "lastname", message: "Lastname is required" },
    !email && { field: "email", message: "Email is required" },
    !password && { field: "password", message: "Password is required" },
  ].filter(Boolean);

  if (errors.length) throw AppError.validationError(errors);

  const response = await executeTransaction(async (client) => {
    const isEmail = await CustomerModel.findByEmail(email, client);

    if (isEmail) throw AppError.conflict("Email already exists");

    if (phone) {
      const isPhone = await CustomerModel.findByPhone(phone, client);
      if (isPhone) throw AppError.conflict("Phone number is already exist.");
    }

    const passwordHash = await toHash(password);

    const customer = await CustomerModel.create(
      firstname,
      lastname,
      email,
      passwordHash,
      phone,
      client,
    );

    const payload = {
      id: customer.id,
      role: "customer",
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const refreshTokenHash = await toHash(refreshToken);
    await TokenModel.insert(customer.id, refreshTokenHash, "customer", client);

    return { customer, accessToken, refreshToken };
  });

  return response;
});

export const getMyProfileService = tryCatch(async (customerId) => {
  if (!customerId) {
    throw AppError.badRequest("Customer id is required.");
  }
  const customer = await CustomerModel.findById(customerId);

  if (!customer) {
    throw AppError.notFound("Customer not found");
  }

  return {
    id: customer.id,
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    total_orders: customer._count.orders,
    is_active: customer.is_active,
    created_at: customer.created_at,
  };
});

export const updateProfileServices = async (body, customerId) => {
  if (!body || Object.keys(body).length === 0) {
    throw AppError.validationError("Body is required to update profile");
  }
  const { firstname, lastname, email, phone } = body;

  return await executeTransaction(async (client) => {
    const customer = await CustomerModel.findById(customerId, client);

    if (!customer) throw AppError.notFound("Customer");

    if (email) {
      const existing = await CustomerModel.findByEmail(email, client);
      if (existing && existing.id !== customerId) {
        throw AppError.conflict("Email already exists");
      }
    }

    if (phone) {
      const existing = await CustomerModel.findByPhone(phone, client);
      if (existing && existing.id !== customerId) {
        throw AppError.conflict("Phone number is already exist.");
      }
    }

    const response = await CustomerModel.updateProfile(
      customerId,
      firstname,
      lastname,
      email,
      phone,
      client,
    );

    if (!response) {
      throw AppError.internal("Something went wrong. Failed to update.");
    }

    return response;
  });
};

export const deleteAccountServices = async (customerId) => {
  if (!customerId) throw AppError.badRequest("Customer id is required");

  return await executeTransaction(async (client) => {
    const customer = await CustomerModel.findById(customerId, client);

    if (!customer) throw AppError.notFound("Customer");

    await CustomerModel.deleteById(customerId, client);
  });
};

export const getAllCustomerServices = async (page, limit) => {
  if (!page || !limit) {
    throw AppError.badRequest(
      "Missing required query parameters",
      'Both "page" and "limit" are required query parameters for pagination',
    );
  }

  return await executeTransaction(async (client) => {
    const skip = (page - 1) * limit;
    let customers = await CustomerModel.getAll(skip, limit, client);
    const totalCustomers = await CustomerModel.totalCount(client);

    if (customers) {
      customers = customers.map((customer) => ({
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        is_active: customer.is_active,
        total_orders: customer._count.orders,
        created_at: customer.created_at,
        deleted_at: customer.deleted_at,
      }));
    }

    const response = {
      success: true,
      message: "Data retrieved successfully",
      customers,
      pagination: {
        totalItems: totalCustomers,
        totalPages: Math.ceil(totalCustomers / limit),
        currentPage: page,
      },
    };

    return response;
  });
};

export const getCustomerByIdServices = async (id) => {
  if (!id)
    throw AppError.badRequest(
      "User ID is required",
      "Missing required parameter: user UUID",
    );

  const customer = await CustomerModel.findById(id);

  if (!customer) throw AppError.notFound("Customer");

  return {
    id: customer.id,
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    total_orders: customer._count.orders,
    is_active: customer.is_active,
    created_at: customer.created_at,
  };
};

export const patchCustomerStatus = async (id, status) => {
  if (!status || (status !== "active" && status !== "deactive")) {
    throw AppError.badRequest(
      "Invalid status value",
      'Status must be either "active" or "deactive"',
    );
  }

  const isActive = status === "active" ? true : false;
  const updated = await CustomerModel.updateStatus(id, isActive);

  return updated;
};
