import Joi from "joi";
import { AppError } from "../utils/error.utils.js";

const validateUUID = (req, res, next) => {
  const schema = Joi.string()
    .guid({ version: ["uuidv1", "uuidv2", "uuidv3", "uuidv4", "uuidv5"] })
    .required();

  const { error } = schema.validate(req.params.id);

  if (error) {
    return next(
      AppError.validationError([
        {
          field: "id",
          message: "Invalid UUID format",
        },
      ]),
    );
  }

  next();
};

export default validateUUID;
