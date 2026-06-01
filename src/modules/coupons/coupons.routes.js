import express from 'express';
import auth from '../../core/middlewares/auth.middleware.js';
import authorizePermission from '../../core/middlewares/pbac.middleware.js';
import validate from '../../core/middlewares/input_validate.middleware.js';
import validateUUID from '../../core/middlewares/valid_uuid.middleware.js';
import * as couponControllers from './coupons.controller.js';
import {
  createCouponSchema,
  getCouponsQuerySchema,
  updateCouponSchema,
} from './coupons.validation.js';

const couponRoutes = express.Router();

couponRoutes.use(auth);

couponRoutes.post(
  '/',
  authorizePermission('coupons.create'),
  validate(createCouponSchema),
  couponControllers.createCoupons
);

couponRoutes.patch(
  '/:id',
  validateUUID,
  authorizePermission('coupons.edit'),
  validate(updateCouponSchema),
  couponControllers.updateCoupon
);

couponRoutes.get(
  '/:id',
  validateUUID,
  authorizePermission('coupons.view'),
  couponControllers.getCoupon
);

couponRoutes.get(
  '/',
  validate(getCouponsQuerySchema, 'query'),
  authorizePermission('coupons.view'),
  couponControllers.getCoupons
);

export default couponRoutes;
