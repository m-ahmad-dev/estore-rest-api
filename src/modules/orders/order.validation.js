import Joi from 'joi';

const addressSchema = Joi.object({
  country_code: Joi.string().min(1).max(2).uppercase().required(),
  province_code: Joi.string().min(2).max(2).uppercase().required(),
  city: Joi.string().min(2).max(120).required(),
  street: Joi.string().trim().min(2).max(500).required(),
  apartment: Joi.string().trim().min(2).max(500).optional(),
  postal_code: Joi.string().pattern(/^\d+$/).optional(),
})
  .unknown(false)
  .required();

export const createAuthUserOrderSchema = Joi.object({
  address_id: Joi.string().uuid().optional(),
  payment_method: Joi.string()
    .valid('CASH_ON_DELIVERY', 'CARD')
    .required(),
})
  .unknown(false)
  .required();

export const createGuestUserOrderSchema = Joi.object({
  guest_name: Joi.string().min(2).max(150).required(),
  guest_email: Joi.string().email().max(255).lowercase().required(),
  guest_phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required(),
  guest_address: addressSchema,
  payment_method: Joi.string()
    .valid('CASH_ON_DELIVERY', 'CARD')
    .required(),
})
  .unknown(false)
  .required();

export const cancelOrderSchema = (req) =>
  Joi.object({
    email: req.user
      ? Joi.forbidden()
      : Joi.string().trim().email().required(),
  })
    .unknown(false)
    .required();

export const getCustomerOrdersSchema = Joi.object({
  cursor: Joi.string().uuid().optional(),
  limit: Joi.number().integer().min(1).max(100).default(15),
  status: Joi.string()
    .valid(
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED'
    )
    .insensitive()
    .optional(),
}).unknown(false);

export const lookupOrderSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
  order_number: Joi.string().trim().required(),
})
  .unknown(false)
  .required();

export const getOrdersAdminSchema = Joi.object({
  cursor: Joi.string().uuid().optional(),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string()
    .valid(
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED'
    )
    .insensitive()
    .optional(),
  payment_status: Joi.string()
    .valid('UNPAID', 'PAID', 'REFUNDED', 'CANCELLED')
    .insensitive()
    .optional(),
  payment_method: Joi.string()
    .valid('CASH_ON_DELIVERY', 'CARD')
    .insensitive()
    .optional(),
  search: Joi.string().trim().allow('').max(100).optional(),
  customer_id: Joi.string().uuid().optional(),
  from_date: Joi.date().iso().max('now').optional(),
  to_date: Joi.date()
    .iso()
    .min(Joi.ref('from_date'))
    .max('now')
    .optional(),
  min_amount: Joi.number().min(0).optional(),
  max_amount: Joi.number().min(Joi.ref('min_amount')).optional(),
  sort: Joi.string()
    .valid('asc', 'desc')
    .insensitive()
    .default('desc'),
}).unknown(false);

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED'
    )
    .required(),
})
  .unknown(false)
  .required();

export const updateOrderPaymentRecordSchema = Joi.object({
  status: Joi.string()
    .valid('PAID', 'UNPAID', 'REFUNDED', 'CANCELLED')
    .required(),
})
  .unknown(false)
  .required();
  
export const updateOrderShipmentRecordSchema = Joi.object({
  status: Joi.string()
    .valid('PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    .required(),
})
  .unknown(false)
  .required();
