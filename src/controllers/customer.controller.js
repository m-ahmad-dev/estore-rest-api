import { registerCustomerService } from "../services/customer.service.js";
import {
  accessCookieConfig,
  refreshCookieConfig,
} from "../utils/cookies.utils.js";
import { AppError } from "../utils/error.utils.js";
import { asyncWrapper } from "../utils/trycatch.js";

export const registerCustomer = asyncWrapper(async (req, res, next) => {
  const { customer, accessToken, refreshToken } = await registerCustomerService(
    req.body,
  );

  if (!customer || !accessToken || !refreshToken) {
    return next(
      AppError.internal("Failed to register customer. Try again later"),
    );
  }

  res.cookie("accessToken", accessToken, accessCookieConfig);
  res.cookie("refreshToken", refreshToken, refreshCookieConfig);

  res.status(201).json({
    success: true,
    message: "Account create successfully.",
    customer,
    accessToken,
  });
});
