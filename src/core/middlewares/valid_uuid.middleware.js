import Joi from 'joi';
import AppError from '../utils/error.utils.js';

const uuidSchema = Joi.string()
  .guid({ version: ['uuidv1', 'uuidv2', 'uuidv3', 'uuidv4', 'uuidv5'] })
  .required();

const UUID_PARAM_PATTERN = /^[a-zA-Z]*[Ii]d$/; // matches: id, userId, variantId, categoryId, etc.

const validateUUID = (req, res, next) => {
  const uuidParams = Object.keys(req.params).filter((key) => UUID_PARAM_PATTERN.test(key));

  if (uuidParams.length === 0) return next();

  const errors = uuidParams.reduce((acc, param) => {
    const { error } = uuidSchema.validate(req.params[param]);
    if (error) acc.push({ field: param, message: `Invalid UUID format for '${param}'` });
    return acc;
  }, []);

  if (errors.length > 0) return next(AppError.validationError(errors));

  next();
};

export default validateUUID;
