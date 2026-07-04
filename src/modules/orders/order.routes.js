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
const adminRouter = express.Router();

/* ==========================================================================
   PUBLIC / CUSTOMER ROUTES
   ========================================================================== */

// Handle dynamic checkout validation elegantly via split endpoints or execution wrapper
router.post(
  '/orders',
  softAuth,
  identifyCartUser,
  (req, res, next) => {
    const schema = req.cartUser.customer_id
      ? orderSchema.createAuthUserOrderSchema
      : orderSchema.createGuestUserOrderSchema;
    return validate(schema)(req, res, next);
  },
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
  identifyCartUser, // Fixed: Added to prevent crashes if guests can cancel orders
  validate(orderSchema.cancelOrderSchema),
  orderControllers.cancelOrder
);

// ADMIN ROUTES (Isolated Scoped Router)

adminRouter.use(auth); 

adminRouter.get(
  '/',
  authorizePermission('orders.view'),
  validate(orderSchema.getOrdersAdminSchema, 'query'),
  orderControllers.getAllOrders
);

adminRouter.get(
  '/:id',
  validateUUID,
  authorizePermission('orders.view'),
  orderControllers.getOrderForAdmin
);

adminRouter.patch(
  '/:id/status',
  validateUUID,
  authorizePermission('orders.edit'),
  validate(orderSchema.updateOrderStatusSchema),
  orderControllers.updateOrderStatus
);

adminRouter.patch(
  '/:id/payment/status',
  validateUUID,
  authorizePermission('orders.update_status'),
  validate(orderSchema.updateOrderPaymentRecordSchema),
  orderControllers.updateOrderPaymentRecord
);

adminRouter.patch(
  '/:id/shipment/status',
  validateUUID,
  authorizePermission('orders.update_status'),
  validate(orderSchema.updateOrderShipmentRecordSchema),
  orderControllers.updateOrderShippingRecord
);

adminRouter.delete(
  '/:id/cancel',
  validateUUID,
  authorizePermission('orders.cancel'),
  orderControllers.cancelOrderAdmin
);

// Mount the admin sub-router cleanly
router.use('/admin/orders', adminRouter);

export default router;
