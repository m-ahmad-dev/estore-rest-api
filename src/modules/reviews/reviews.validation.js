import Joi from 'joi';

export const createReviewSchema = Joi.object({
  order_id: Joi.string().uuid().required().messages({
    'string.guid': 'The provided order ID format is invalid.',
    'any.required': 'Order ID is required to submit a review.',
  }),

  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'Rating must be a number.',
    'number.min': 'Rating must be at least 1 star.',
    'number.max': 'Rating cannot exceed 5 stars.',
    'any.required': 'Please provide a star rating.',
  }),

  title: Joi.string()
    .min(2)
    .max(120)
    .allow(null, '')
    .optional()
    .messages({
      'string.min':
        'Review title must be at least 2 characters long.',
      'string.max': 'Review title cannot exceed 120 characters.',
    }),

  comment: Joi.string()
    .max(2000)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': 'Review comments cannot exceed 2000 characters.',
    }),
})
  .unknown(false)
  .required();

export const updateReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional().messages({
    'number.base': 'Rating must be a number.',
    'number.min': 'Rating must be at least 1 star.',
    'number.max': 'Rating cannot exceed 5 stars.',
  }),

  title: Joi.string()
    .trim()
    .min(2)
    .max(120)
    .allow(null, '')
    .optional()
    .messages({
      'string.min':
        'Review title must be at least 2 characters long.',
      'string.max': 'Review title cannot exceed 120 characters.',
    }),

  comment: Joi.string()
    .trim()
    .max(2000)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': 'Review comments cannot exceed 2000 characters.',
    }),
})
  .unknown(false)
  .min(1)
  .messages({
    'object.min':
      'At least one field (rating, title, or comment) must be provided.',
  });

export const getCustomerReviewsSchema = Joi.object({
  cursor: Joi.string().uuid().optional().messages({
    'string.guid': 'Invalid cursor format.',
  }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .messages({
      'number.base': 'Limit must be a number.',
      'number.min': 'Limit must be at least 1.',
      'number.max': 'Limit cannot exceed 100.',
    }),

  status: Joi.string()
    .valid('PENDING', 'APPROVED', 'REJECTED')
    .insensitive()
    .optional()
    .messages({
      'any.only':
        'Status must be one of: PENDING, APPROVED, REJECTED.',
    }),
});

export const getProductReviewsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  rating: Joi.number().integer().min(1).max(5).optional(),
  sort: Joi.string()
    .valid('created_at', 'rating', 'helpful_count')
    .default('created_at'),
  order: Joi.string()
    .valid('asc', 'desc')
    .lowercase()
    .default('desc'),
}).unknown(false);
