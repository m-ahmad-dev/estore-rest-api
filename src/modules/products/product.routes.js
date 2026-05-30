import express from 'express';
import auth from '../../core/middlewares/auth.middleware.js';
import authorizePermission from '../../core/middlewares/pbac.middleware.js';
import validate from '../../core/middlewares/input_validate.middleware.js';
import * as productControllers from './product.controller.js';
import validateUUID from '../../core/middlewares/valid_uuid.middleware.js';
import {
  adminProductsQuerySchema,
  createProductSchema,
  publicProductsQuerySchema,
  updateProductSchema,
} from './product.validation.js';
import {
  variantAdminRoutes,
  variantPublicRoutes,
} from './variants/variants.routes.js';
import {
  imagesAdminRoutes,
  imagesPublicRoutes,
} from './images/images.routes.js';

const productRoutes = express.Router();

// ===== PUBLIC ROUTES =====

productRoutes.get(
  '/products',
  validate(publicProductsQuerySchema, 'query'),
  productControllers.getAllProducts
);

productRoutes.get(
  '/products/:slug',
  validateUUID,
  productControllers.getProductBySlug
);

// ===== ADMIN ROUTES =====
productRoutes.use('/admin/products', auth);

productRoutes.get(
  '/admin/products',
  authorizePermission('products.view'),
  validate(adminProductsQuerySchema, 'query'),
  productControllers.getAllProductsAdmin
);
productRoutes.get(
  '/admin/products/:id',
  validateUUID,
  authorizePermission('products.view'),
  productControllers.getProductById
);

productRoutes.post(
  '/admin/products',
  authorizePermission('products.create'),
  validate(createProductSchema),
  productControllers.createProduct
);

productRoutes.patch(
  '/admin/products/:id',
  validateUUID,
  authorizePermission('products.edit'),
  validate(updateProductSchema),
  productControllers.updateProduct
);

productRoutes.delete(
  '/admin/products/:id',
  validateUUID,
  authorizePermission('products.delete'),
  productControllers.deleteProduct
);

productRoutes.patch(
  '/admin/products/:id/restore',
  validateUUID,
  authorizePermission('product.edit'),
  productControllers.restoreProduct
);

productRoutes.delete(
  '/admin/products/:id/permanent',
  validateUUID,
  authorizePermission('products.delete'),
  productControllers.hardDeleteProduct
);

// ===== Nested Routes For Variants & Images =====

// Variant Routes
productRoutes.use('/products/:productId/variants', variantPublicRoutes);
productRoutes.use('/admin/products/:productId/variants', variantAdminRoutes);

// Images Routes
productRoutes.use('/products/:productId/images', imagesPublicRoutes);
productRoutes.use('/admin/products/:productId/images', imagesAdminRoutes);

export default productRoutes;
