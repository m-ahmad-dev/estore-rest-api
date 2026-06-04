import Joi from 'joi';

export const addCartItemSchema = Joi.object({
  variant_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).default(1),
})
  .unknown(false)
  .required();

export const updateCartItemSchema = Joi.object({
  action: Joi.string()
    .valid('increment', 'decrement', 'replace')
    .required(),
  quantity: Joi.number().integer().min(1).required(),
})
  .unknown(false)
  .required();

export const applyCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().max(50).required(),
})
  .unknown(false)
  .required();
