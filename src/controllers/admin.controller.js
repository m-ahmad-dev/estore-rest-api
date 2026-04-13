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
  try {
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
  } catch (error) {
    next(error);
  }
});

export const getAllAdmins = asyncWrapper(async (req, res, next) => {
  try {
    const admins = await getAllAdminsService();
    return res.status(200).json({ success: true, admins });
  } catch (error) {
    next(error);
  }
});

export const getAdminById = asyncWrapper(async (req, res, next) => {
  try {
    const data = await getAdminByIdService(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export const updateAdminStatus = asyncWrapper(async (req, res, next) => {
  try {
    await updateAdminStatusService(req.params.id, req.body.status);
    return res
      .status(200)
      .json({ success: true, message: "Admin status updated." });
  } catch (error) {
    next(error);
  }
});

export const deleteAdmin = asyncWrapper(async (req, res, next) => {
  try {
    await deleteAdminService(req.params.id);
    return res
      .status(200)
      .json({ success: true, message: "Admin deleted successfully." });
  } catch (error) {
    next(error);
  }
});
