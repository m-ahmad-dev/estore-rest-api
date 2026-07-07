import * as reviewServices from './reviews.service.js';
import { asyncWrapper } from '../../core/utils/trycatch.js';

export const createReview = asyncWrapper(async (req, res) => {
  const result = await reviewServices.createProductReview(
    req.user.id,
    req.params.productId,
    req.body
  );

  res.status(201).json(result);
});

export const editReview = asyncWrapper(async (req, res) => {
  const result = await reviewServices.updateReview(
    req.user.id,
    req.params.id,
    req.body
  );

  res.status(200).json(result);
});

export const deleteReview = asyncWrapper(async (req, res) => {
  const result = await reviewServices.deleteService(
    req.user.id,
    req.params.id
  );

  res.status(200).json(result);
});

export const getMyReviews = asyncWrapper(async (req, res) => {
  const result = await reviewServices.getCustomerReviews(
    req.user.id,
    req.query
  );

  res.status(200).json(result);
});

export const getProductReviews = asyncWrapper(async (req, res) => {
  const result = await reviewServices.findForProduct(
    req.params.productId,
    req.query
  );

  res.status(200).json(result);
});
