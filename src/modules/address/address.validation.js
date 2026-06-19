import Joi from 'joi';

export const createAddressSchema = Joi.object({
  label: Joi.string().trim().max(50).optional().allow(null, ''),
  street: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'Street address is required',
    'any.required': 'Street address is required',
  }),
  city: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'City is required',
    'any.required': 'City is required',
  }),
  province: Joi.string().trim().max(100).optional().required(),
  province_code: Joi.string()
    .trim()
    .min(2)
    .max(2)
    .uppercase()
    .required(),
  country: Joi.string().trim().min(1).max(100).optional().required(),
  country_code: Joi.string().min(1).max(2).uppercase().required(),
  postal_code: Joi.string().trim().max(20).optional().allow(null, ''),
  is_default: Joi.boolean().optional().default(false),
})
  .required()
  .messages({
    'any.required': 'Request body is missing',
    'object.base': 'Body must be valid object',
  });

export const updateAddressSchema = Joi.object({
  label: Joi.string().trim().max(50).optional().allow(null, ''),
  street: Joi.string().trim().min(1).max(255).optional(),
  city: Joi.string().trim().min(1).max(100).optional(),
  province: Joi.string().trim().max(100).optional(),
  province_code: Joi.string()
    .trim()
    .min(2)
    .max(2)
    .uppercase()
    .optional(),
  country: Joi.string().trim().min(1).max(100).optional(),
  country_code: Joi.string().min(2).max(2).uppercase().optional(),
  postal_code: Joi.string().trim().max(20).optional().allow(null, ''),
  is_default: Joi.boolean().optional(),
}).min(1);
