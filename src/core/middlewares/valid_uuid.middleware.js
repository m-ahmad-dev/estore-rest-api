import Joi from "joi";
import AppError from "../utils/error.utils.js";

const validateUUID = (req, res, next) => {
  const schema = Joi.string()
    .guid({ version: ["uuidv1", "uuidv2", "uuidv3", "uuidv4", "uuidv5"] })
    .required();

  const id = req.params.id;

  if (!id) {
    return next(
      AppError.badRequest(
        "User ID is required",
        "Missing required parameter: user UUID",
      ),
    );
  }

  const { error } = schema.validate(id);

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
