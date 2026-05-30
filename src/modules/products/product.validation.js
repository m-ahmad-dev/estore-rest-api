import Joi from 'joi';
import {
  validateReservedStock,
  validateUniqueVariantAttributes,
} from './variants/variants.utils.js';
import {
  validateAtMostOnePrimary,
  validateExactlyOnePrimary,
  validateUniqueImageKeys,
} from './images/images.utils.js';

// Base fields
const fields = {
  uuid: Joi.string().uuid(),
  name: Joi.string().trim().min(3).max(255),
  description: Joi.string().trim().max(2000).allow('', null),
  price: Joi.number().precision(2).min(0),
  nonNegativeInt: Joi.number().integer().min(0),
  positiveInt: Joi.number().integer().positive(),
};

// Attribute schema
export const attributesSchema = Joi.object()
  .pattern(
    Joi.string().trim().min(1).max(100),
    Joi.alternatives().try(
      Joi.string().trim().max(255),
      Joi.number(),
      Joi.boolean(),
      Joi.array().items(
        Joi.alternatives().try(Joi.string().trim().max(255), Joi.number())
      )
    )
  )
  .min(1)
  .required();

// Image schema
export const imageSchema = Joi.object({
  key: Joi.string()
    .trim()
    .min(1)
    .max(500)
    .required()
    .pattern(/^[a-zA-Z0-9/_\-.]+$/)
    .messages({
      'string.pattern.base':
        'Image key can only contain letters, numbers, underscores, hyphens, dots, and slashes',
    }),

  alt_text: Joi.string().trim().max(255).allow('', null),
  is_primary: Joi.boolean(),
  sort_order: fields.nonNegativeInt.allow(null),
}).unknown(false);

const imagesArraySchema = Joi.array()
  .items(imageSchema)
  .min(1)
  .required()
  .custom(validateUniqueImageKeys)
  .custom(validateAtMostOnePrimary)
  .messages({
    'array.unique': 'Image keys must be unique',
    'any.invalid': 'At most one primary image is allowed',
  });

// Variant schema
export const variantSchema = Joi.object({
  attributes: attributesSchema,
  sku: Joi.string().trim().max(100).optional(),
  price: fields.price.required(),
  stock_quantity: fields.nonNegativeInt.required(),
  reserved_quantity: fields.nonNegativeInt.default(0),
  reorder_level: fields.nonNegativeInt.default(5),
})
  .custom(validateReservedStock)
  .messages({
    'any.invalid': 'Reserved quantity cannot exceed stock quantity',
  });

// Variants array schema
export const variantsArraySchema = Joi.array()
  .items(variantSchema)
  .min(1)
  .required()
  .custom(validateUniqueVariantAttributes)
  .messages({
    'array.unique': 'Duplicate variant attributes are not allowed',
  });

// Create product
export const createProductSchema = Joi.object({
  name: fields.name.required(),
  description: fields.description,
  category_id: fields.uuid.required(),
  base_price: fields.price.required(),
  is_active: Joi.boolean().default(true),
  variants: variantsArraySchema,
  images: imagesArraySchema.custom(validateExactlyOnePrimary).messages({
    'any.invalid': 'Exactly one primary image is required',
  }),
})
  .required()
  .unknown(false)
  .messages({
    'any.required': 'Request body is required',
    'object.base': 'Request body must be an object',
  });

// Update product
export const updateProductSchema = Joi.object({
  name: fields.name,
  description: fields.description,
  category_id: fields.uuid,
  base_price: fields.price,
  is_active: Joi.boolean(),
})
  .min(1)
  .required()
  .unknown(false)
  .messages({
    'object.min': 'At least one field is required for update',
  });

// Create variants
export const createVariantsSchema = Joi.object({
  variants: variantsArraySchema,
})
  .required()
  .unknown(false);

// Update variant
export const updateVariantSchema = Joi.object({
  sku: Joi.string().trim().max(100),
  price: fields.price,
})
  .min(1)
  .required()
  .unknown(false)
  .messages({
    'object.min': 'At least one field is required for update',
  });

// Stock operations
const STOCK_OPERATIONS = [
  'stock.add',
  'stock.reduce',
  'stock.reserve',
  'reserved_stock.release',
  'reserved_stock.confirm',
];

const STOCK_SET_FIELDS = [
  'stock_quantity',
  'reserved_quantity',
  'reorder_level',
];

// Update stock
export const updateVariantStockSchema = Joi.object({
  operation: Joi.string()
    .valid(...STOCK_OPERATIONS, 'stock.set')
    .required(),

  quantity: Joi.when('operation', {
    is: Joi.valid(...STOCK_OPERATIONS),
    then: fields.positiveInt.required(),
    otherwise: Joi.forbidden(),
  }),

  stock_quantity: Joi.when('operation', {
    is: 'stock.set',
    then: fields.nonNegativeInt,
    otherwise: Joi.forbidden(),
  }),

  reserved_quantity: Joi.when('operation', {
    is: 'stock.set',
    then: fields.nonNegativeInt,
    otherwise: Joi.forbidden(),
  }),

  reorder_level: Joi.when('operation', {
    is: 'stock.set',
    then: fields.nonNegativeInt,
    otherwise: Joi.forbidden(),
  }),
})
  .when(Joi.object({ operation: 'stock.set' }).unknown(), {
    then: Joi.object().or(...STOCK_SET_FIELDS),
  })
  .required()
  .min(1)
  .unknown(false);

// Add images
export const addImagesSchema = Joi.object({
  images: imagesArraySchema,
})
  .required()
  .unknown(false);

// Reorder images
export const reorderProductImagesSchema = Joi.object({
  imageIds: Joi.array().items(fields.uuid).min(1).unique().required().messages({
    'array.unique': 'Image IDs must be unique',
    'array.min': 'At least one image ID is required',
  }),
})
  .required()
  .unknown(false);

// Update image
export const updateImageSchema = Joi.object({
  alt_text: Joi.string().trim().max(255).allow('', null),
})
  .min(1)
  .required()
  .unknown(false);

const baseProductsQuerySchema = Joi.object({
  q: Joi.string().allow('').max(100).optional().trim(),
  category: Joi.string().min(1).max(50).optional().trim(),
  min_price: Joi.number().min(0).optional(),
  max_price: Joi.number().min(0).optional(),
  sort: Joi.string()
    .valid('price', 'created_at', 'name')
    .optional()
    .lowercase()
    .trim(),
  order: Joi.string().valid('asc', 'desc').optional().lowercase().trim(),
  limit: Joi.number().integer().min(1).optional().default(10),
  cursor: Joi.string()
    .allow('')
    .max(100)
    .optional()
    .trim()
    .regex(/^[a-zA-Z0-9_-]*$/),
})
  .unknown(false)
  .messages({
    'object.unknown': 'Invalid query parameter: {{#key}}',
    'string.empty': '{{#label}} cannot be empty',
    'string.min': '{{#label}} cannot be empty',
    'number.base': '{{#label}} must be a valid number',
  });

// Public schema just reuses the base with a stricter limit
export const publicProductsQuerySchema = baseProductsQuerySchema.keys({
  limit: Joi.number().integer().min(1).max(50).optional().default(10),
});

// Admin schema extends the base with extra fields
export const adminProductsQuerySchema = baseProductsQuerySchema.keys({
  limit: Joi.number().integer().min(1).max(100).optional().default(10),
  include_deleted: Joi.string()
    .valid('true', 'false')
    .optional()
    .lowercase()
    .trim(),
  status: Joi.string()
    .valid('active', 'inactive', 'all')
    .optional()
    .lowercase()
    .trim(),
});
