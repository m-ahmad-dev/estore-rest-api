import express from 'express';
import * as cartControllers from './cart.controller.js';
import validate from '../../core/middlewares/input_validate.middleware.js';
import validateUUID from '../../core/middlewares/valid_uuid.middleware.js';
import softAuth from '../../core/middlewares/soft-auth.middleware.js';
import identifyCartUser from '../../core/middlewares/identify_user.middleware.js';
import {
  addCartItemSchema,
  updateCartItemSchema,
  applyCouponSchema,
} from './cart.validation.js';

const router = express.Router();

router.use(softAuth);

router.get('/', identifyCartUser, cartControllers.getCart);

router.post(
  '/items',
  identifyCartUser,
  validate(addCartItemSchema),
  cartControllers.addCartItem
);

router.patch(
  '/items/:id',
  validateUUID,
  identifyCartUser,
  validate(updateCartItemSchema),
  cartControllers.updateCartItem
);

router.delete(
  '/items/:id',
  validateUUID,
  identifyCartUser,
  cartControllers.removeCartItem
);

router.delete('/', identifyCartUser, cartControllers.clearCart);

router.patch(
  '/coupon',
  identifyCartUser,
  validate(applyCouponSchema),
  cartControllers.applyCoupon
);

router.delete(
  '/coupon',
  identifyCartUser,
  cartControllers.removeCoupon
);

export default router;
