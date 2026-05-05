import Joi from "joi";

export const attributeRuleSchema = Joi.object({
  name: Joi.string().trim().lowercase().required(),
  label: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string().valid("string", "number", "boolean", "enum").required(),
  required: Joi.boolean().default(false),
  options: Joi.when("type", {
    is: "enum",
    then: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
    otherwise: Joi.forbidden(),
  }),
});

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  parent_id: Joi.string().guid({ version: "uuidv4" }).allow(null, ""),
  description: Joi.string().trim().max(270).allow(null, ""),
  is_active: Joi.boolean().default(true),
  attribute_rules: Joi.array()
    .items(attributeRuleSchema)
    .unique((a, b) => a.name === b.name)
    .messages({
      "array.unique": "Attribute rule names must be unique within a category",
    })
    .optional(),
});

export const updateCategorySchema = createCategorySchema
  .fork(["name"], (schema) => schema.optional())
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
    "any.required": "Request body is missing",
    "object.base": "Body must be a valid object",
  });

export const updateAttributeRuleSchema = Joi.object({
  name: Joi.forbidden().messages({
    "any.unknown":
      "Attribute name cannot be changed. Delete and re-create the attribute if a rename is needed.",
  }),
  label: Joi.string().trim().min(1).max(100).optional(),
  type: Joi.string().valid("string", "number", "boolean", "enum").optional(),
  required: Joi.boolean().optional(),
  options: Joi.when("type", {
    is: "enum",
    then: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
    otherwise: Joi.array().items(Joi.string().trim().min(1)).min(1).optional(),
  }),
})
  .min(1)
  .messages({
    "object.min":
      "At least one field (label, type, required, or options) must be provided for update",
    "object.base": "Update data must be a valid object",
  });
