import Joi from 'joi';

export const getAllCountriesSchema = Joi.object({
  search: Joi.string()
    .allow('')
    .trim()
    .lowercase()
    .default('')
    .optional(),
  is_active: Joi.boolean().optional(),
  order: Joi.string().valid('asc', 'desc').default('asc').optional(),
}).unknown(false);

export const toggleStatusSchema = Joi.object({
  is_active: Joi.boolean().required(),
}).unknown(false);

export const checkCountryIdSchema = Joi.object({
  id: Joi.number().integer().min(0).required(),
}).unknown(false);
