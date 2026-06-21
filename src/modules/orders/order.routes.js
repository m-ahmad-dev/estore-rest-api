import express from 'express';
import * as orderControllers from './order.controller.js';
import identifyCartUser from '../../core/middlewares/identify_user.middleware.js';
import validate from '../../core/middlewares/input_validate.middleware.js';
import validateUUID from '../../core/middlewares/valid_uuid.middleware.js';
import softAuth from '../../core/middlewares/soft-auth.middleware.js';
import auth from '../../core/middlewares/auth.middleware.js';
import {
  cancelOrderSchema,
  createAuthUserOrderSchema,
  createGuestUserOrderSchema,
  getCustomerOrdersSchema,
  lookupOrderSchema,
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

router.get(
  '/orders',
  auth,
  validate(getCustomerOrdersSchema, 'query'),
  orderControllers.getCustomersOrders
);

router.get(
  '/orders/lookup',
  softAuth,
  validate(lookupOrderSchema, 'query'),
  orderControllers.lookupGuestOrder
);

router.get(
  '/orders/:id',
  validateUUID,
  auth,
  orderControllers.getCustomerOrder
);

router.patch(
  '/orders/:id/cancel',
  validateUUID,
  softAuth,
  validate(cancelOrderSchema),
  orderControllers.cancelOrder
);

export default router;
