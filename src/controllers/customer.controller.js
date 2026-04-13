import { registerCustomerService } from "../services/customer.service.js";
import { sendError } from "../utils/error.utils.js";
import { asyncWrapper } from "../utils/trycatch.js";

export const registerCustomer = asyncWrapper(async (req, res, next) => {
  const { customer, accessToken, refreshToken } = await registerCustomerService(
    req.body,
  );

  if (!customer || !accessToken || !refreshToken) {
    return next(
      sendError(
        "Internal server error.",
        500,
        "Failed to register customer.",
        "SERVER_ERROR",
      ),
    );
  }

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/api/v1/refresh-token",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    success: true,
    message: "Account create successfully.",
    customer,
    accessToken,
  });
});
