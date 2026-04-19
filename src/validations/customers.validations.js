import Joi from "joi";

export const registerSchema = Joi.object({
  firstname: Joi.string().trim().min(2).max(150).required(),
  lastname: Joi.string().trim().min(2).max(150).required(),
  email: Joi.string().trim().email().lowercase().required(),
  password: Joi.string().min(8).max(128).required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{7,20}$/)
    .optional()
    .allow(null, ""),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
  password: Joi.string().min(8).max(128).required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
});
