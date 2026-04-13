import { sendError } from "../utils/error.utils.js";

const validate = (schema) => async (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false, // Collect all errors instead of stopping at the first one
    stripUnknown: true, // Remove fields not defined in the schema (Security best practice)
  });

  if (error) {
    const message = error.details.map((d) => d.message).join(", ");
    return next(sendError(message, 400));
  }

  // Replace req.body with the sanitized/validated values
  req.body = value;
  next();
};

export default validate;
