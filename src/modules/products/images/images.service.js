import ProdImagesModel from './images.model.js';
import executeTransaction from '../../../core/utils/dbTransaction.js';
import AppError from '../../../core/utils/error.utils.js';
import { formatPublicImages, prepareImages, SORT_GAP } from './images.utils.js';
import { validateProductExists } from '../product.utils.js';

export const getProductImagesService = async ({ productId, isAdmin }) => {
  return await executeTransaction(async (client) => {
    await validateProductExists(productId, client);

    const images = await ProdImagesModel.findByProductId(productId, client);
    if (!isAdmin) return images.map(formatPublicImages);

    return images;
  });
};

export const getImageService = async ({ productId, imageId, isAdmin }) => {
  return await executeTransaction(async (client) => {
    await validateProductAndImageOwnership(productId, imageId, client);

    const image = await ProdImagesModel.findById(productId, imageId, client);
    if (!isAdmin) return formatPublicImages(image);

    return image;
  });
};

export const addImagesService = async (productId, images) => {
  return executeTransaction(async (client) => {
    return saveImages(productId, images, client);
  });
};

export const updateImageService = async (productId, imageId, updates) => {
  return executeTransaction(async (client) => {
    await validateProductAndImageOwnership(productId, imageId, client);

    const updatedImage = await ProdImagesModel.update(imageId, updates, client);

    return updatedImage;
  });
};

export const setImageAsPrimaryService = async (productId, imageId) => {
  return executeTransaction(async (client) => {
    const image = await ProdImagesModel.findByIdAndProduct(
      productId,
      imageId,
      client
    );

    if (!image) throw AppError.notFound('Image', 'Image not found');
    if (image.is_primary) return image;

    await ProdImagesModel.clearPrimary(productId, imageId, client);
    return await ProdImagesModel.setPrimary(imageId, client);
  });
};

export const reorderProductImagesService = async (productId, imageIds) => {
  return executeTransaction(async (client) => {
    await validateProductExists(productId, client);
    await validateReorderRequest(productId, imageIds, client);

    const sortMap = new Map();
    imageIds.forEach((id, index) => {
      sortMap.set(id, (index + 1) * SORT_GAP);
    });

    await ProdImagesModel.updateSortOrdersBulk(imageIds, sortMap, client);

    return await ProdImagesModel.findByProductId(productId, client);
  });
};

export const deleteImageService = async (productId, imageId) => {
  return executeTransaction(async (client) => {
    await validateProductExists(productId, client);

    const image = await ProdImagesModel.findByIdAndProduct(
      productId,
      imageId,
      client
    );
    if (!image) throw AppError.notFound('Image', 'Image not found');

    await ProdImagesModel.delete(imageId, client);

    // Promote next image to primary if deleted image was primary
    if (image.is_primary) {
      const remainingImages = await ProdImagesModel.findByProductId(
        productId,
        client
      );
      if (remainingImages.length > 0) {
        await ProdImagesModel.clearPrimary(productId, null, client);
        await ProdImagesModel.setPrimary(remainingImages[0].id, client);
      }
    }

    // Re-normalize sort orders
    const finalImages = await ProdImagesModel.findByProductId(
      productId,
      client
    );
    if (finalImages.length > 0) {
      const sortMap = new Map();
      finalImages.forEach((img, index) => {
        sortMap.set(img.id, (index + 1) * SORT_GAP);
      });
      await ProdImagesModel.updateSortOrdersBulk(
        finalImages.map((img) => img.id),
        sortMap,
        client
      );
    }

    return { id: image.id };
  });
};

// Shared Services
export const deleteImagesByProduct = async (productId, client) => {
  return ProdImagesModel.deleteByProduct(productId, client);
};

export const insertImagesService = async (productId, images, client) => {
  return saveImages(productId, images, client);
};

// ====== Private Helper Functions =======

async function validateProductAndImageOwnership(productId, imageId, client) {
  await validateProductExists(productId, client);

  const image = await ProdImagesModel.findByIdAndProduct(
    productId,
    imageId,
    client
  );
  if (!image) throw AppError.notFound('Image', 'Image not found');
}

async function validateReorderRequest(productId, imageIds, client) {
  const existingImages = await ProdImagesModel.findByProductId(
    productId,
    client
  );

  if (!existingImages.length) {
    throw AppError.badRequest('No images available to reorder');
  }

  const existingImageIds = new Set(existingImages.map((img) => img.id));

  if (imageIds.length !== existingImageIds.size) {
    throw AppError.badRequest(
      'All images of the product must be included in the reorder request'
    );
  }

  for (const id of imageIds) {
    if (!existingImageIds.has(id)) {
      throw AppError.badRequest(
        `Image ID ${id} does not belong to this product`
      );
    }
  }
}

// Core logic for saving images:
async function saveImages(productId, images, db) {
  await validateProductExists(productId, db);

  const keys = images.map((img) => img.key.trim());
  const existingKeys = await ProdImagesModel.findKeys(productId, keys, db);

  if (existingKeys.length > 0) {
    throw AppError.conflict('Some images already exist for this product');
  }

  const [existingPrimary, maxSortOrder] = await Promise.all([
    ProdImagesModel.findPrimary(productId, db),
    ProdImagesModel.getMaxSortOrder(productId, db),
  ]);

  const preparedImages = prepareImages(images, maxSortOrder + SORT_GAP);

  const hasIncomingPrimary = preparedImages.some((img) => img.is_primary);

  if (!existingPrimary && !hasIncomingPrimary && preparedImages.length > 0) {
    preparedImages[0].is_primary = true;
  }

  if (hasIncomingPrimary && existingPrimary) {
    await ProdImagesModel.clearPrimary(productId, null, db);
  }

  return await ProdImagesModel.insertMany(productId, preparedImages, db);
}
