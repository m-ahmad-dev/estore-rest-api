import * as wishlistServices from './wishlist.service.js';
import { asyncWrapper } from '../../core/utils/trycatch.js';

export const addToWishlist = asyncWrapper(async (req, res) => {
  const result = await wishlistServices.createWishlist(
    req.user?.id,
    req.body
  );

  res.status(201).json(result);
});

export const getWishlist = asyncWrapper(async (req, res) => {
  const result = await wishlistServices.getUserWishlist(
    req.user?.id,
    req.query
  );

  res.status(200).json(result);
});

export const removeFromWishlist = asyncWrapper(async (req, res) => {
  const result = await wishlistServices.deleteRecord(
    req.user.id,
    req.params.id
  );

  res.status(200).json(result);
});
