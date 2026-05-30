import * as productServices from './product.service.js';
import { asyncWrapper } from '../../core/utils/trycatch.js';

// Admin: Create product with variants and images
export const createProduct = asyncWrapper(async (req, res) => {
  const result = await productServices.createProductService(req.body);
  res.status(201).json(result);
});

// Admin: Update product details
export const updateProduct = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await productServices.updateProductService(id, req.body);
  res.status(200).json(result);
});

// Admin: Soft delete product
export const deleteProduct = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await productServices.deleteProductService(id);
  res.status(200).json(result);
});

// Admin: Restore soft deleted product
export const restoreProduct = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await productServices.updateProductService(id, {
    deleted_at: null,
  });
  res.status(200).json({
    success: true,
    message: 'Product restored successfully!',
    product: result.product,
  });
});

// Admin: Permanently delete product
export const hardDeleteProduct = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await productServices.hardDeleteProductService(id);
  res.status(200).json(result);
});

// Admin: Get product by ID
export const getProductById = asyncWrapper(async (req, res) => {
  const result = await productServices.getProductByIdService(req.params.id);
  res.status(200).json({
    success: true,
    message: 'Product retrieved successfully',
    product: result,
  });
});

// Public: Get product by slug
export const getProductBySlug = asyncWrapper(async (req, res) => {
  const result = await productServices.getProductBySlugService(req.params.slug);
  res.status(200).json({
    success: true,
    message: 'Product retrieved successfully',
    product: result,
  });
});

// Public: Get all products with cursor pagination and filtering sorting
export const getAllProducts = asyncWrapper(async (req, res) => {
  const result = await productServices.getAllProductsService(req.query);
  res.status(200).json(result);
});

// Admin: Get all products with cursor pagination and filtering sorting
export const getAllProductsAdmin = asyncWrapper(async (req, res) => {
  const result = await productServices.getAllProductsService(req.query, true);
  res.status(200).json(result);
});
