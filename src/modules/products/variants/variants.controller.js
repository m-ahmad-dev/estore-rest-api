import * as variantService from './variants.service.js';
import { asyncWrapper } from '../../../core/utils/trycatch.js';

export const createVariants = asyncWrapper(async (req, res) => {
  const { productId } = req.params;
  const { variants } = req.body;

  const result = await variantService.createVariants(productId, variants);

  res.status(201).json({
    success: true,
    message: 'Variants created successfully',
    data: result,
  });
});

export const updateVariant = asyncWrapper(async (req, res) => {
  const { productId, variantId } = req.params;
  const result = await variantService.updateVariant(
    productId,
    variantId,
    req.body
  );

  res.status(200).json(result);
});

export const deleteVariant = asyncWrapper(async (req, res) => {
  const { productId, variantId } = req.params;
  const result = await variantService.softDeleteVariant(productId, variantId);

  res.status(200).json(result);
});

export const restoreVariant = asyncWrapper(async (req, res) => {
  const { productId, variantId } = req.params;
  const result = await variantService.restoreVariant(productId, variantId);

  res.status(200).json(result);
});

export const updateVariantStock = asyncWrapper(async (req, res) => {
  const { productId, variantId } = req.params;
  const result = await variantService.updateVariantStock(
    productId,
    variantId,
    req.body
  );

  res.status(200).json(result);
});

export const getProductVariants = asyncWrapper(async (req, res) => {
  const { productId } = req.params;
  const includeDeleted = req.query.include_deleted === 'true';

  const variants = await variantService.getProductVariants(productId, {
    isAdmin: false,
    includeDeleted,
  });

  res.status(200).json({
    success: true,
    message: 'Product variants retrieved successfully',
    data: variants,
  });
});

export const getProductVariantsAdmin = asyncWrapper(async (req, res) => {
  const { productId } = req.params;
  const includeDeleted = req.query.include_deleted === 'true';

  const variants = await variantService.getProductVariants(productId, {
    isAdmin: true,
    includeDeleted,
  });

  res.status(200).json({
    success: true,
    message: 'Product variants retrieved successfully',
    data: variants,
  });
});

export const getVariant = asyncWrapper(async (req, res) => {
  const { productId, variantId } = req.params;
  const variant = await variantService.getVariantById(productId, variantId, {
    isAdmin: false,
  });

  res.status(200).json({
    success: true,
    message: 'Variant retrieved successfully',
    data: variant,
  });
});

export const getVariantAdmin = asyncWrapper(async (req, res) => {
  const { productId, variantId } = req.params;
  const variant = await variantService.getVariantById(productId, variantId, {
    isAdmin: true,
  });

  res.status(200).json({
    success: true,
    message: 'Variant retrieved successfully',
    data: variant,
  });
});
