import { asyncWrapper } from "../../core/utils/trycatch.js";
import AppError from "../../core/utils/error.utils.js";
import {
  accessCookieConfig,
  clearAuthCookies,
  refreshCookieConfig,
} from "../../core/utils/cookies.utils.js";
import {
  deleteAccountServices,
  getAllCustomerServices,
  getCustomerByIdServices,
  getMyProfileService,
  patchCustomerStatus,
  registerCustomerService,
  updateProfileServices,
} from "./customer.service.js";

// CURD:

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
    message: "Account created successfully.",
    customer,
    accessToken,
  });
});

export const getMyProfile = asyncWrapper(async (req, res) => {
  const result = await getMyProfileService(req.user.id);

  return res.status(200).json({
    success: true,
    message: "Data retrieved successfully",
    customer: result,
  });
});

export const updateMyProfile = asyncWrapper(async (req, res) => {
  const result = await updateProfileServices(req.body, req.user.id);

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    customer: result,
  });
});

export const deleteAccount = asyncWrapper(async (req, res) => {
  await deleteAccountServices(req.user.id);

  clearAuthCookies(res);

  res.status(200).json({
    success: true,
    message: "Account deleted successfully.",
  });
});

// Controllers for customers manage by admin:

export const getAllCustomers = asyncWrapper(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = parseInt(req.query.limit) || 10; // Default to 10 items
  const result = await getAllCustomerServices(page, limit);

  res.status(200).json(result);
});

export const getCustomerByID = asyncWrapper(async (req, res) => {
  const result = await getCustomerByIdServices(req.params.id);

  res.status(200).json({
    success: true,
    message: "Data retrieved successfully",
    customer: result,
  });
});

export const editCustomerProfile = asyncWrapper(async (req, res) => {
  const result = await updateProfileServices(req.body, req.params.id);

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    customer: result,
  });
});

export const changeCustomerStatus = asyncWrapper(async (req, res) => {
  const result = await patchCustomerStatus(req.params.id, req.body.status);

  return res.status(result ? 200 : 500).json({
    success: result,
    message: result ? "Status changed successfully." : "Something went wrong.",
  });
});
