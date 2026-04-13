import Joi from "joi";
import { sendError } from "../utils/error.utils.js";

const validateUUID = (req, res, next) => {
  const schema = Joi.string()
    .guid({ version: ["uuidv1", "uuidv2", "uuidv3", "uuidv4", "uuidv5"] })
    .required();

  const { error } = schema.validate(req.params.id);

  if (error) {
    return next(
      sendError("Invalid id format", 400, error.message, "INVALID_ID_FORMAT"),
    );
  }

  next();
};

export default validateUUID;
