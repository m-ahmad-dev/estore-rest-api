import { asyncWrapper } from '../../core/utils/trycatch.js';
import * as orderServices from './order.service.js';

export const createOrder = asyncWrapper(async (req, res) => {
  const result = await orderServices.createOrderService(
    req.cartUser,
    req.body
  );

  res.status(201).json(result);
});

export const cancelOrder = asyncWrapper(async (req, res) => {
  const result = await orderServices.cancelOrderService({
    orderId: req.params.id,
    user: req.user,
    guestEmail: req.body?.email,
  });

  res.status(200).json(result);
});

export const getCustomersOrders = asyncWrapper(async (req, res) => {
  const result = await orderServices.getCustomerOrdersService(
    req.user.id,
    req.query
  );

  res.status(200).json(result);
});

export const getCustomerOrder = asyncWrapper(async (req, res) => {
  const result = await orderServices.getCustomerOrderService(
    req.params.id,
    req.user
  );

  res.status(200).json(result);
});

export const lookupGuestOrder = asyncWrapper(async (req, res) => {
  const result = await orderServices.lookupOrderService(
    req.user,
    req.query
  );

  res.status(200).json(result);
});

export const getAllOrders = asyncWrapper(async (req, res) => {
  const result = await orderServices.getAllOrdersService(req.query);

  res.status(200).json(result);
});

export const getOrderForAdmin = asyncWrapper(async (req, res) => {
  const result = await orderServices.getOrderForAdminService(
    req.params.id
  );

  res.status(200).json(result);
});

export const updateOrderStatus = asyncWrapper(async (req, res) => {
  const result = await orderServices.updateOrderStatusService(
    req.params.id,
    req.body
  );

  res.status(200).json(result);
});

export const updateOrderPaymentRecord = asyncWrapper(
  async (req, res) => {
    const result =
      await orderServices.updateOrderPaymentStatusService(
        req.params.id,
        req.body
      );

    res.status(200).json(result);
  }
);

export const updateOrderShippingRecord = asyncWrapper(
  async (req, res) => {
    const result =
      await orderServices.updateOrderShippingStatusService(
        req.params.id,
        req.body
      );

    res.status(200).json(result);
  }
);

export const cancelOrderAdmin = asyncWrapper(async (req, res) => {
  const result = await orderServices.cancelOrderAdminService({
    orderId: req.params.id,
    admin: req.user,
  });

  res.status(200).json(result);
});
