import AppError from '../utils/error.utils.js';

const safelyUpdate = (target, newValues) => {
  // Clear existing properties (handles potential read-only objects in some environments)
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, newValues);
};

const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    let dataToValidate;

    switch (source) {
      case 'query':
        dataToValidate = req.query;
        break;

      case 'params':
        dataToValidate = req.params;
        break;

      case 'all':
        dataToValidate = {
          ...req.params,
          ...req.query,
          ...req.body,
        };
        break;

      case 'body':
      default:
        dataToValidate = req.body;
        break;
    }

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path?.join('.') || source,
        message: detail.message.replace(/"/g, ''),
      }));

      return next(AppError.validationError(details));
    }

    // Apply validated & cleaned values back
    switch (source) {
      case 'query':
        safelyUpdate(req.query, value);
        break;

      case 'params':
        safelyUpdate(req.params, value);
        break;

      case 'all':
        // For "all", we only update body with the validated result (safest behavior)
        safelyUpdate(req.body, value);
        break;

      default:
        safelyUpdate(req.body, value);
        break;
    }

    next();
  };
};

export default validate;
