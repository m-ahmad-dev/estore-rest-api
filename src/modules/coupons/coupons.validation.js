import Joi from 'joi';

const validateCouponDates = (value, helpers) => {
  const { starts_at, expires_at } = value;

  if (starts_at && expires_at) {
    if (new Date(starts_at) > new Date(expires_at)) {
      return helpers.message({
        custom:
          'Expiration date must be greater than or equal to the start date',
      });
    }
  }

  if (expires_at && new Date(expires_at) <= new Date()) {
    return helpers.message({
      custom: 'Expiration date must be in the future',
    });
  }

  return value;
};

const couponBaseFields = {
  code: Joi.string()
    .trim()
    .uppercase()
    .min(3)
    .max(50)
    .pattern(/^[A-Z0-9_]+$/)
    .alter({
      create: (schema) => schema.required(),
      update: (schema) => schema.optional(),
    })
    .messages({
      'any.required': 'Coupon code is required',
      'string.empty': 'Coupon code is required',
      'string.pattern.base':
        'Coupon code must contain only letters, numbers and underscores',
      'string.min': 'Coupon code must be at least 3 characters',
      'string.max': 'Coupon code cannot exceed 50 characters',
    }),
  type: Joi.string()
    .valid('PERCENTAGE', 'FIXED')
    .alter({
      create: (schema) => schema.required(),
      update: (schema) => schema.optional(),
    })
    .messages({
      'any.required': 'Please select a coupon type',
      'any.only': 'Please select a coupon type',
    }),
  value: Joi.number()
    .alter({
      create: (schema) => schema.required(),
      update: (schema) => schema.optional(),
    })
    .when('type', {
      is: 'PERCENTAGE',
      then: Joi.number().integer().min(1).max(100).messages({
        'number.integer': 'Percentage must be a whole number',
        'number.min': 'Percentage must be between 1 and 100',
        'number.max': 'Percentage must be between 1 and 100',
      }),
      otherwise: Joi.when('type', {
        is: 'FIXED',
        then: Joi.number().precision(2).greater(0).messages({
          'number.greater': 'Fixed discount must be greater than 0',
        }),
        otherwise: Joi.number().greater(0),
      }),
    })
    .messages({
      'any.required': 'Value is required',
      'number.base': 'Value must be a number',
    }),
  min_order_value: Joi.number()
    .min(0)
    .precision(2)
    .optional()
    .allow(null)
    .alter({
      create: (schema) => schema.default(0),
      update: (schema) => schema.allow(null),
    })
    .messages({
      'number.min': 'Value cannot be negative',
    }),
  max_discount: Joi.number()
    .precision(2)
    .optional()
    .allow(null)
    .when('type', {
      is: 'PERCENTAGE',
      then: Joi.number().positive().optional().allow(null),
      otherwise: Joi.when('type', {
        is: 'FIXED',
        then: Joi.forbidden(),
        otherwise: Joi.number().positive().optional().allow(null),
      }),
    })
    .messages({
      'any.unknown':
        'Maximum discount is only allowed for percentage coupons',
      'any.forbidden':
        'Maximum discount is only allowed for percentage coupons',
      'number.positive': 'Maximum discount must be greater than 0',
    }),
  max_uses: Joi.number()
    .integer()
    .min(1)
    .optional()
    .allow(null)
    .alter({
      create: (schema) => schema.default(null),
      update: (schema) => schema.allow(null),
    })
    .messages({
      'number.min': 'Maximum uses must be greater than 0',
      'number.integer': 'Maximum uses must be a whole number',
    }),
  is_active: Joi.boolean()
    .optional()
    .alter({
      create: (schema) => schema.default(true),
    }),
  starts_at: Joi.date()
    .iso()
    .optional()
    .allow(null)
    .alter({
      create: (schema) => schema.default(null),
      update: (schema) => schema.allow(null),
    }),
  expires_at: Joi.date()
    .iso()
    .optional()
    .allow(null)
    .alter({
      create: (schema) => schema.default(null),
      update: (schema) => schema.allow(null),
    }),
};

export const createCouponSchema = Joi.object(couponBaseFields)
  .tailor('create')
  .custom(validateCouponDates)
  .unknown(false);

export const updateCouponSchema = Joi.object(couponBaseFields)
  .tailor('update')
  .custom(validateCouponDates)
  .unknown(false);

export const getCouponsQuerySchema = Joi.object({
  cursor:    Joi.string().base64().optional(),
  search:    Joi.string().trim().max(50).optional(),
  is_active: Joi.boolean()
               .truthy('true', '1')
               .falsy('false', '0')
               .sensitive(false)
               .optional(),
  type:      Joi.string().valid('PERCENTAGE', 'FIXED').optional(),
  limit:     Joi.number().integer().min(1).max(100).default(10),
}).unknown(false);