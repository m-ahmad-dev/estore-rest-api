import * as couponServices from './coupons.service.js';
import { asyncWrapper } from '../../core/utils/trycatch.js';

export const createCoupons = asyncWrapper(async (req, res) => {
  const result = await couponServices.createCouponService(req.body);
  res.status(201).json(result);
});

export const updateCoupon = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await couponServices.updateCouponService(id, req.body);
  res.status(200).json(result);
});

export const getCoupon = asyncWrapper(async (req, res) => {
  const coupon = await couponServices.getCouponById(req.params.id);
  res.status(200).json({
    success: true,
    message: 'Data retrived successfully',
    coupon,
  });
});

export const getCoupons = asyncWrapper(async (req, res) => {
  const result = await couponServices.getAllCoupons(req.query);
  res.status(200).json(result);
});
