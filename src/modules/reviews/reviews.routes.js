import express from 'express';
import auth from '../../core/middlewares/auth.middleware.js';
import validate from '../../core/middlewares/input_validate.middleware.js';
import validateUUID from '../../core/middlewares/valid_uuid.middleware.js';
import authorizePermission from '../../core/middlewares/pbac.middleware.js';
import * as reviewsController from './reviews.controller.js';
import * as reviewSchema from './reviews.validation.js';

const router = express.Router();

router.get(
  '/products/:productId/reviews',
  validateUUID,
  validate(reviewSchema.getProductReviewsSchema, 'query'),
  reviewsController.getProductReviews
);

router.post(
  '/products/:productId/reviews',
  validateUUID,
  auth,
  validate(reviewSchema.createReviewSchema),
  reviewsController.createReview
);

router.get(
  '/reviews/me',
  auth,
  validate(reviewSchema.getCustomerReviewsSchema, 'query'),
  reviewsController.getMyReviews
);

router.patch(
  '/reviews/:id',
  validateUUID,
  auth,
  validate(reviewSchema.updateReviewSchema),
  reviewsController.editReview
);

router.delete(
  '/reviews/:id',
  validateUUID,
  auth,
  reviewsController.deleteReview
);

// Admin Access routes

router.get(
  '/admin/reviews',
  auth,
  authorizePermission('reviews.view'),
  validate(reviewSchema.getAllReviewsSchema, 'query'),
  reviewsController.getReviewsForAdmin
);

export default router;
