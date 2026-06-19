import express from 'express';
import * as orderControllers from './order.controller.js';
import identifyCartUser from '../../core/middlewares/identify_user.middleware.js';
import validate from '../../core/middlewares/input_validate.middleware.js';
import {
  createAuthUserOrderSchema,
  createGuestUserOrderSchema,
} from './order.validation.js';

const router = express.Router();

router.post(
  '/orders',
  identifyCartUser,
  validate((req) =>
    req.cartUser.customer_id
      ? createAuthUserOrderSchema
      : createGuestUserOrderSchema
  ),
  orderControllers.createOrder
);

export default router;
