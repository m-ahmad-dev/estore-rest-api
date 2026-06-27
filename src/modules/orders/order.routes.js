import express from 'express';
import * as orderControllers from './order.controller.js';
import identifyCartUser from '../../core/middlewares/identify_user.middleware.js';
import validate from '../../core/middlewares/input_validate.middleware.js';
import validateUUID from '../../core/middlewares/valid_uuid.middleware.js';
import softAuth from '../../core/middlewares/soft-auth.middleware.js';
import auth from '../../core/middlewares/auth.middleware.js';
import authorizePermission from '../../core/middlewares/pbac.middleware.js';
import * as orderSchema from './order.validation.js';

const router = express.Router();

router.post(
  '/orders',
  identifyCartUser,
  validate((req) =>
    req.cartUser.customer_id
      ? orderSchema.createAuthUserOrderSchema
      : orderSchema.createGuestUserOrderSchema
  ),
  orderControllers.createOrder
);

router.get(
  '/orders',
  auth,
  validate(orderSchema.getCustomerOrdersSchema, 'query'),
  orderControllers.getCustomersOrders
);

router.get(
  '/orders/lookup',
  softAuth,
  validate(orderSchema.lookupOrderSchema, 'query'),
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
  validate(orderSchema.cancelOrderSchema),
  orderControllers.cancelOrder
);

// Admin Access Routes
router.use('/admin/orders', auth);

router.get(
  '/admin/orders',
  authorizePermission('orders.view'),
  validate(orderSchema.getOrdersAdminSchema, 'query'),
  orderControllers.getAllOrders
);

router.get(
  '/admin/orders/:id',
  validateUUID,
  authorizePermission('orders.view'),
  orderControllers.getOrderForAdmin
);

router.patch(
  '/admin/orders/:id/status',
  validateUUID,
  authorizePermission('orders.edit'),
  validate(orderSchema.updateOrderStatusSchema),
  orderControllers.updateOrderStatus
);

router.patch(
  '/admin/orders/:id/payment/status',
  validateUUID,
  authorizePermission('orders.update_status'),
  validate(orderSchema.updateOrderPaymentRecordSchema),
  orderControllers.updateOrderPaymentRecord
);
router.patch(
  '/admin/orders/:id/shipment/status',
  validateUUID,
  authorizePermission('orders.update_status'),
  validate(orderSchema.updateOrderShipmentRecordSchema),
  orderControllers.updateOrderShippingRecord
);

router.delete(
  '/admin/orders/:id/cancel',
  validateUUID,
  authorizePermission('orders.cancel'),
  orderControllers.cancelOrderAdmin
);

export default router;
