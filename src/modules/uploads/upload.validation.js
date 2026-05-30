import Joi from "joi";

export const getPresignedUrlSchema = Joi.object({
  fileName: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .pattern(/^[a-zA-Z0-9_.-]+$/)
    .required()
    .messages({
      "string.min": "File name must be at least 3 characters",
      "string.max": "File name cannot exceed 100 characters",
      "string.pattern.base":
        "File name can only contain letters, numbers, dots, hyphens, and underscores",
      "any.required": "File name is required",
    }),
  fileType: Joi.string()
    .valid("image/jpeg", "image/png", "image/webp")
    .required()
    .messages({
      "any.only": "File type must be one of: image/jpeg, image/png, image/webp",
      "any.required": "File type is required",
    }),
})
  .required()
  .messages({
    "object.base": "Request must be a valid object",
    "any.required": "Request parameters are missing",
  });
