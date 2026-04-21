import {
  createAdminService,
  getAllAdminsService,
  getAdminByIdService,
  updateAdminStatusService,
  deleteAdminService,
} from "../services/admin.service.js";
import { asyncWrapper } from "../utils/trycatch.js";

// ADMIN MANAGEMENT CONTROLLERS

export const createNewAdmin = asyncWrapper(async (req, res, next) => {
  const { name, email, password, phone, permissions = [] } = req.body;
  const createdBy = req.user?.id ?? null;

  const admin = await createAdminService(
    name,
    email,
    password,
    phone,
    permissions,
    createdBy,
  );

  return res.status(201).json({
    success: true,
    message: "Admin created successfully.",
    admin,
  });
});

export const getAllAdmins = asyncWrapper(async (req, res, next) => {
  const admins = await getAllAdminsService();
  return res
    .status(200)
    .json({ success: true, message: "Data retrieved successfully", admins });
});

export const getAdminById = asyncWrapper(async (req, res, next) => {
  const data = await getAdminByIdService(req.params.id);
  return res.status(200).json({
    success: true,
    message: "Data retrieved successfully",
    admin: data,
  });
});

export const updateAdminStatus = asyncWrapper(async (req, res, next) => {
  const result = await updateAdminStatusService(req.params.id, req.body.status);
  
  return res.status(result ? 200 : 500).json({
    success: result,
    message: result ? "Status changed successfully." : "Something went worng.",
  });
});

export const deleteAdmin = asyncWrapper(async (req, res, next) => {
  await deleteAdminService(req.params.id);
  return res
    .status(200)
    .json({ success: true, message: "Admin deleted successfully." });
});
