import * as cartService from './cart.service.js';
import { asyncWrapper } from '../../core/utils/trycatch.js';

export const getCart = asyncWrapper(async (req, res) => {
  const result = await cartService.getCart(req.cartUser);
  res.status(200).json(result);
});

export const addCartItem = asyncWrapper(async (req, res) => {
  const result = await cartService.addCartItem(
    req.cartUser,
    req.body
  );
  res.status(201).json(result);
});

export const updateCartItem = asyncWrapper(async (req, res) => {
  const result = await cartService.updateCartItem(
    req.params.id,
    req.cartUser,
    req.body
  );
  res.status(200).json(result);
});

export const removeCartItem = asyncWrapper(async (req, res) => {
  const result = await cartService.removeCartItem(
    req.params.id,
    req.cartUser
  );
  res.status(200).json(result);
});

export const clearCart = asyncWrapper(async (req, res) => {
  const result = await cartService.clearCart(req.cartUser);
  res.status(200).json(result);
});

export const applyCoupon = asyncWrapper(async (req, res) => {
  const result = await cartService.applyCoupon(
    req.cartUser,
    req.body.code
  );
  res.status(200).json(result);
});

export const removeCoupon = asyncWrapper(async (req, res) => {
  const result = await cartService.removeCoupon(req.cartUser);
  res.status(200).json(result);
});
