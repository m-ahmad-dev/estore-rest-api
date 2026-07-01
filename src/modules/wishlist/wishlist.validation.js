import Joi from 'joi';

export const createWishlistSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
})
  .unknown(false)
  .required();

export const getWishlistSchema = Joi.object({
  cursor: Joi.string().uuid().optional(),
  limit: Joi.number().max(100).default(20),
  sort: Joi.string()
    .valid('recent', 'oldest')
    .default('recent')
    .insensitive(),
}).unknown(false);
