import * as imagesServices from './images.service.js';
import { asyncWrapper } from '../../../core/utils/trycatch.js';

// Get all images for a product:
export const getProductImages = asyncWrapper(async (req, res) => {
  const result = await imagesServices.getProductImagesService(req.params);

  res.status(200).json({
    success: true,
    message: 'Product images retrieved successfully',
    data: result,
  });
});

export const getProductImagesAdmin = asyncWrapper(async (req, res) => {
  const result = await imagesServices.getProductImagesService({
    productId: req.params.productId,
    isAdmin: true,
  });

  res.status(200).json({
    success: true,
    message: 'Product images retrieved successfully',
    data: result,
  });
});

export const getImage = asyncWrapper(async (req, res) => {
  const { productId, imageId } = req.params;
  const result = await imagesServices.getImageService({
    productId,
    imageId,
  });

  res.status(200).json({
    success: true,
    message: 'Image retrieved successfully',
    data: result,
  });
});
export const getImageAdmin = asyncWrapper(async (req, res) => {
  const { productId, imageId } = req.params;
  const result = await imagesServices.getImageService({
    productId,
    imageId,
    isAdmin: true,
  });

  res.status(200).json({
    success: true,
    message: 'Image retrieved successfully',
    data: result,
  });
});

// Add multiple images to a product:
export const addImages = asyncWrapper(async (req, res) => {
  const { productId } = req.params;
  const result = await imagesServices.addImagesService(
    productId,
    req.body.images
  );

  res.status(201).json({
    success: true,
    message: 'Images added successfully',
    data: result,
  });
});

// Update a specific image:
export const updateImage = asyncWrapper(async (req, res) => {
  const { productId, imageId } = req.params;
  const result = await imagesServices.updateImageService(
    productId,
    imageId,
    req.body
  );

  res.status(200).json({
    success: true,
    message: 'Image updated successfully',
    data: result,
  });
});

// Set an image as primary:
export const setImageAsPrimary = asyncWrapper(async (req, res) => {
  const { productId, imageId } = req.params;
  const result = await imagesServices.setImageAsPrimaryService(
    productId,
    imageId
  );

  res.status(200).json({
    success: true,
    message: 'Image set as primary successfully',
    data: result,
  });
});

// Reorder product images:
export const reorderProductImages = asyncWrapper(async (req, res) => {
  const result = await imagesServices.reorderProductImagesService(
    req.params.productId,
    req.body.imageIds
  );

  res.status(200).json({
    success: true,
    message: 'Images reordered successfully',
    data: result,
  });
});

// Delete a product image:
export const deleteImage = asyncWrapper(async (req, res) => {
  const { productId, imageId } = req.params;
  const result = await imagesServices.deleteImageService(productId, imageId);

  res.status(200).json({
    success: true,
    message: 'Image deleted successfully',
    data: result,
  });
});
