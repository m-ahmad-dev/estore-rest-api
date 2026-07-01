import express from 'express';
import * as wishlistSchema from './wishlist.validation.js';
import * as wishlistControllers from './wishlist.controller.js';
import auth from '../../core/middlewares/auth.middleware.js';
import validate from '../../core/middlewares/input_validate.middleware.js';
import validateUUID from '../../core/middlewares/valid_uuid.middleware.js';

const router = express.Router();

router.post(
  '/',
  auth,
  validate(wishlistSchema.createWishlistSchema),
  wishlistControllers.addToWishlist
);

router.get(
  '/',
  auth,
  validate(wishlistSchema.getWishlistSchema, 'query'),
  wishlistControllers.getWishlist
);

router.delete(
  '/:id',
  auth,
  validateUUID,
  wishlistControllers.removeFromWishlist
);

export default router;
