import express from 'express';
import authorizePermission from '../../../core/middlewares/pbac.middleware.js';
import validate from '../../../core/middlewares/input_validate.middleware.js';
import * as imagesControllers from './images.controller.js';
import {
  addImagesSchema,
  reorderProductImagesSchema,
  updateImageSchema,
} from '../product.validation.js';
import validateUUID from '../../../core/middlewares/valid_uuid.middleware.js';

const publicRoutes = express.Router({ mergeParams: true });

publicRoutes.get('/', validateUUID, imagesControllers.getProductImages);
publicRoutes.get('/:imageId', validateUUID, imagesControllers.getImage);

// ===== ADMIN ROUTES =====
const adminRoutes = express.Router({ mergeParams: true });

adminRoutes.get(
  '/',
  validateUUID,
  authorizePermission('products.view'),
  imagesControllers.getProductImagesAdmin
);

adminRoutes.get(
  '/:imageId',
  validateUUID,
  authorizePermission('products.view'),
  imagesControllers.getImageAdmin
);

adminRoutes.post(
  '/',
  validateUUID,
  authorizePermission('products.edit'),
  validate(addImagesSchema),
  imagesControllers.addImages
);

adminRoutes.patch(
  '/:imageId/primary',
  validateUUID,
  authorizePermission('products.edit'),
  imagesControllers.setImageAsPrimary
);

adminRoutes.patch(
  '/reorder',
  validateUUID,
  authorizePermission('products.edit'),
  validate(reorderProductImagesSchema),
  imagesControllers.reorderProductImages
);

adminRoutes.patch(
  '/:imageId',
  validateUUID,
  authorizePermission('products.edit'),
  validate(updateImageSchema),
  imagesControllers.updateImage
);

adminRoutes.delete(
  '/:imageId',
  validateUUID,
  authorizePermission('products.delete'),
  imagesControllers.deleteImage
);

export { publicRoutes as imagesPublicRoutes, adminRoutes as imagesAdminRoutes };
