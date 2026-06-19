import { asyncWrapper } from '../../core/utils/trycatch.js';
import * as orderServices from './order.service.js';

export const createOrder = asyncWrapper(async (req, res) => {
  const result = await orderServices.createOrderService(
    req.cartUser,
    req.body
  );
  
  res.status(201).json(result);
});
