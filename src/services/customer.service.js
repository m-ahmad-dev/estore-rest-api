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
    const isExist = await CustomerModel.findByEmail(email, client);

    if (isExist) {
      throw AppError.conflict("Email already exists");
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
