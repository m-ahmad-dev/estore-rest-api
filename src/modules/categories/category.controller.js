import { asyncWrapper } from "../../core/utils/trycatch.js";
import * as categoryService from "./category.service.js";

// ----- Admin Access -----

export const createCategory = asyncWrapper(async (req, res) => {
  const result = await categoryService.create(req.body);
  res.status(201).json(result);
});

export const getAllCategoriesFlat = asyncWrapper(async (req, res) => {
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

// ─── Public Access ───

export const getAllCategoriesTree = asyncWrapper(async (req, res) => {
  const result = await categoryService.getAllTree();
  res.status(200).json(result);
});

export const getCategoryDetail = asyncWrapper(async (req, res) => {
  const result = await categoryService.getWithDetail(req.params.slug);
  res.status(200).json(result);
});

export const getRootCategories = asyncWrapper(async (req, res) => {
  const result = await categoryService.getRootParent();
  res.status(200).json(result);
});

// ─── Attribute management ───

export const getCategoryAttributes = asyncWrapper(async (req, res) => {
  const result = await categoryService.getAttributes(req.params.id);
  res.status(200).json(result);
});

export const addAttribute = asyncWrapper(async (req, res) => {
  const result = await categoryService.addAttributeToCategory(
    req.params.id,
    req.body,
  );
  res.status(201).json(result);
});

export const updateAttribute = asyncWrapper(async (req, res) => {
  const result = await categoryService.updateAttributeInCategory(
    req.params.id,
    req.params.attrName,
    req.body,
  );
  res.status(200).json(result);
});

export const removeAttribute = asyncWrapper(async (req, res) => {
  const result = await categoryService.deleteAttributeFromCategory(
    req.params.id,
    req.params.attrName,
  );
  res.status(200).json(result);
});
