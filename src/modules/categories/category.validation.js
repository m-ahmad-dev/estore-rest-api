import Joi from "joi";

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Category name is required",
    "any.required": "Category name is required",
  }),
  parent_id: Joi.string()
    .guid({ version: "uuidv4" })
    .trim()
    .optional()
    .allow(null, ""),
  description: Joi.string().trim().max(270).optional().allow(null, ""),
  is_active: Joi.boolean().optional(),
})
  .required()
  .messages({
    "any.required": "Request body is missing",
    "object.base": "Body must be valid object",
  });

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  parent_id: Joi.string()
    .guid({ version: "uuidv4" })
    .trim()
    .optional()
    .allow(null, ""),
  description: Joi.string().trim().max(270).optional().allow(null, ""),
  is_active: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
    "object.base": "Body must be valid object",
  });
