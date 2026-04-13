import Joi from "joi";

export const createAdminSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  email: Joi.string().trim().email().lowercase().required(),
  password: Joi.string().min(8).max(128).required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{7,20}$/)
    .optional()
    .allow(null, ""),
  permissions: Joi.array()
    .items(Joi.string().pattern(/^[a-z._*]+$/))
    .unique()
    .default([]),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

export const permissionSchema = Joi.object({
  permissions: Joi.array()
    .items(Joi.string().pattern(/^[a-z._*]+$/))
    .required()
    .unique()
    .default([]),
});

export const singlePermissionSchema = Joi.object({
  permissions: Joi.array()
    .items(
      Joi.string()
        .trim()
        .pattern(/^[a-z._*]+$/)
        .required(),
    )
    .length(1)
    .unique()
    .required(),
});
