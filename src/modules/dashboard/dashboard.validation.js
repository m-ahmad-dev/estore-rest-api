import Joi from 'joi';
import { VALID_PERIODS } from './dashboard.utils.js';

// Validate the optional dashboard period query parameter.
export const periodQuerySchema = Joi.object({
  period: Joi.string()
    .valid(...VALID_PERIODS)
    .default('today')
    .messages({
      'any.only': `"period" must be one of: ${VALID_PERIODS.join(', ')}`,
    }),
}).unknown(false);
