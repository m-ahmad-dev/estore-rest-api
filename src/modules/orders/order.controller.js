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
  const { id } = req.params;
  const result = await orderServices.cancelOrderService(
    id,
    req.user,
    req.body
  );

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
