import CustomerModel from "../models/customer.model.js";
import TokenModel from "../models/token.model.js";
import { toHash } from "../utils/bcrypt.utils.js";
import executeTransaction from "../utils/dbTransaction.js";
import { sendError } from "../utils/error.utils.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwtoken.utils.js";
import { tryCatch } from "../utils/trycatch.js";

// CUSTOMER MANAGEMENT SERVICES

export const registerCustomerService = tryCatch(async (params) => {
  const { firstname, lastname, email, password, phone } = params;
  if (!firstname || !lastname || !email || !password) {
    throw sendError(
      "Make sure no required field is missing.",
      400,
      "Bad Request",
    );
  }
  const response = await executeTransaction(async (client) => {
    const isExist = await CustomerModel.findByEmail(email, client);
    if (isExist) throw sendError("Email already exists.", 409);

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
      name: `${customer.first_name} ${customer.last_name}`,
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
