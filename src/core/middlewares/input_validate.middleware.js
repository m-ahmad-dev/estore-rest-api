import AppError from '../utils/error.utils.js';

// Mutates target object safely by replacing all properties
const mutateObject = (target, src) => {
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, src);
};

// Map of request sources to extract data
const dataExtractors = {
  query: (req) => req.query,
  params: (req) => req.params,
  body: (req) => req.body,
  all: (req) => ({ ...req.params, ...req.query, ...req.body }),
};

const validate = (targetSchema, source = 'body') => {
  return async (req, res, next) => {
    const data = (dataExtractors[source] || dataExtractors.body)(req);
    const schema =
      typeof targetSchema === 'function'
        ? targetSchema(req)
        : targetSchema;

    // Fail-safe guard for malformed schema declarations
    if (!schema?.validate) {
      return next(
        AppError.internal('Validation config error: Invalid schema.')
      );
    }

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(({ path, message }) => ({
        field: path?.join('.') || source,
        message: message.replace(/"/g, ''),
      }));

      return next(AppError.validationError(details));
    }

    // Write cleaned values back to the appropriate request location
    const targetKey = source === 'all' ? 'body' : source;
    mutateObject(req[targetKey] || req.body, value);

    next();
  };
};

export default validate;
