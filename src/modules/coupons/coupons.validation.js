import Joi from 'joi';

const validateCouponDates = (value, helpers) => {
  // Date validation
  if (value.starts_at && value.expires_at) {
    if (new Date(value.starts_at) >= new Date(value.expires_at)) {
      return helpers.message({ custom: 'starts_at must be before expires_at' });
    }
  }

  // expires_at should be in future if provided
  if (value.expires_at && new Date(value.expires_at) <= new Date()) {
    return helpers.message({ custom: 'expires_at must be in the future' });
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
      'string.pattern.base':
        'Coupon code must be alphanumeric (uppercase letters, numbers and underscores only)',
      'string.min': 'Coupon code must be at least 3 characters',
      'string.max': 'Coupon code cannot exceed 50 characters',
    }),
  type: Joi.string()
    .valid('PERCENTAGE', 'FIXED')
    .alter({
      create: (schema) => schema.required(),
      update: (schema) => schema.optional(),
    }),
  value: Joi.number()
    .positive()
    .precision(2)
    .alter({
      create: (schema) => schema.required(),
      update: (schema) => schema.optional(),
    })
    .when('type', {
      is: 'PERCENTAGE',
      then: Joi.number().max(100),
      otherwise: Joi.number().min(0.01),
    })
    .messages({
      'number.max': 'Percentage discount cannot exceed 100%',
      'number.positive': 'Value must be greater than 0',
    }),
  min_order_value: Joi.number()
    .min(0)
    .precision(2)
    .optional()
    .alter({
      create: (schema) => schema.default(0),
    }),
  max_discount: Joi.number()
    .positive()
    .precision(2)
    .optional()
    .when('type', {
      is: 'PERCENTAGE',
      then: Joi.number()
        .min(0.01)
        .alter({
          create: (schema) => schema.required(),
        }),
      otherwise: Joi.forbidden(),
    })
    .messages({
      'any.required': 'max_discount is required for PERCENTAGE coupons',
      'any.unknown': 'max_discount is only allowed for PERCENTAGE coupons',
    }),
  max_uses: Joi.number()
    .integer()
    .min(1)
    .optional()
    .alter({
      create: (schema) => schema.default(null),
      update: (schema) => schema.allow(null),
    }),
  is_active: Joi.boolean()
    .optional()
    .alter({
      create: (schema) => schema.default(true),
    }),
  starts_at: Joi.date()
    .iso()
    .optional()
    .alter({
      create: (schema) => schema.default(null),
      update: (schema) => schema.allow(null),
    }),
  expires_at: Joi.date()
    .iso()
    .optional()
    .alter({
      create: (schema) => schema.default(null),
      update: (schema) => schema.allow(null),
    }),
};

// Exported Schemas tailored by their respective built mode
export const createCouponSchema = Joi.object(couponBaseFields)
  .tailor('create')
  .custom(validateCouponDates)
  .unknown(false);

export const updateCouponSchema = Joi.object(couponBaseFields)
  .tailor('update')
  .custom(validateCouponDates)
  .unknown(false);

export const getCouponsQuerySchema = Joi.object({
  cursor: Joi.string().base64().optional(),
  search: Joi.string().trim().max(50).optional(),
  is_active: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .optional(),
  type: Joi.string().valid('PERCENTAGE', 'FIXED').optional(),
  limit: Joi.number().integer().min(1).max(100).default(10),
}).unknown(false);
