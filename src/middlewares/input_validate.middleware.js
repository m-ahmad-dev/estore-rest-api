import { AppError } from "../utils/error.utils.js";

const validate = (schema) => async (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false, // Collect all errors instead of stopping at first one
    stripUnknown: true, // Remove fields not defined in schema (security best practice)
  });

  if (error) {
    const details = error.details.map((d) => ({
      message: d.message,
      path: d.path?.join("."),
    }));

    return next(AppError.validationError(details));
  }

  // Replace req.body with sanitized values
  req.body = value;

  next();
};

export default validate;
