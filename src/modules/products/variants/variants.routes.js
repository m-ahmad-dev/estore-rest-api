import express from 'express';
import authorizePermission from '../../../core/middlewares/pbac.middleware.js';
import validate from '../../../core/middlewares/input_validate.middleware.js';
import validateUUID from '../../../core/middlewares/valid_uuid.middleware.js';
import * as variantController from './variants.controller.js';
import {
  createVariantsSchema,
  updateVariantSchema,
  updateVariantStockSchema,
} from '../product.validation.js';

// Public routes
const publicRouter = express.Router({ mergeParams: true });
publicRouter.get('/', validateUUID, variantController.getProductVariants);
publicRouter.get('/:variantId', validateUUID, variantController.getVariant);

// Admin routes
const adminRouter = express.Router({ mergeParams: true });

adminRouter.post(
  '/',
  validateUUID,
  authorizePermission('products.edit'),
  validate(createVariantsSchema),
  variantController.createVariants
);

adminRouter.patch(
  '/:variantId',
  validateUUID,
  authorizePermission('products.edit'),
  validate(updateVariantSchema),
  variantController.updateVariant
);

adminRouter.delete(
  '/:variantId',
  validateUUID,
  authorizePermission('products.delete'),
  variantController.deleteVariant
);

adminRouter.patch(
  '/:variantId/restore',
  validateUUID,
  authorizePermission('products.edit'),
  variantController.restoreVariant
);

adminRouter.patch(
  '/:variantId/stock',
  validateUUID,
  validate(updateVariantStockSchema),
  authorizePermission('products.edit'),
  variantController.updateVariantStock
);

adminRouter.get(
  '/',
  validateUUID,
  authorizePermission('products.view'),
  variantController.getProductVariantsAdmin
);

adminRouter.get(
  '/:variantId',
  validateUUID,
  authorizePermission('products.view'),
  variantController.getVariantAdmin
);

export {
  publicRouter as variantPublicRoutes,
  adminRouter as variantAdminRoutes,
};
