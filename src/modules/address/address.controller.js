import { asyncWrapper } from "../../core/utils/trycatch.js";
import * as addressService from "./address.service.js";

export const createAddress = asyncWrapper(async (req, res) => {
  const result = await addressService.create(req.user.id, req.body);
  res.status(201).json(result);
});

export const getAllAddresses = asyncWrapper(async (req, res) => {
  const result = await addressService.getAll(req.user.id);
  res.status(200).json(result);
});

export const getSingleAddress = asyncWrapper(async (req, res) => {
  const result = await addressService.getOne(req.params.id);
  res.status(200).json(result);
});

export const updateAddress = asyncWrapper(async (req, res) => {
  const result = await addressService.update(
    req.user.id,
    req.params.id,
    req.body,
  );
  res.status(200).json(result);
});

export const removeAddress = asyncWrapper(async (req, res) => {
  const result = await addressService.remove(req.params.id);
  res.status(200).json(result);
});

// Admin Access:
export const getCustomerAddresses = asyncWrapper(async (req, res) => {
  const result = await addressService.getAll(req.params.id);
  res.status(200).json(result);
});
