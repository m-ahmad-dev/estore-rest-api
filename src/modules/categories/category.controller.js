import { asyncWrapper } from "../../core/utils/trycatch.js";
import * as categoryService from "./category.service.js";

// Admin Access Controllers
export const createCategory = asyncWrapper(async (req, res) => {
  const result = await categoryService.create(req.body);
  res.status(201).json(result);
});

export const getAllCategories = asyncWrapper(async (req, res) => {
  const result = await categoryService.getAll(req.query);
  res.status(200).json(result);
});

export const getSingleCategory = asyncWrapper(async (req, res) => {
  const result = await categoryService.getOne(req.params.id);
  res.status(200).json(result);
});

export const updateCategory = asyncWrapper(async (req, res) => {
  const result = await categoryService.edit(req.params.id, req.body);
  res.status(200).json(result);
});

export const removeCategory = asyncWrapper(async (req, res) => {
  await categoryService.remove(req.params.id);
  return res.status(204).send();
});
