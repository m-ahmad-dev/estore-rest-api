import chalk from "chalk";
import env from "../configs/env.js";
import { sendError } from "../utils/error.utils.js";

const errorMiddleware = (err, req, res, next) => {
  console.error(chalk.red.bold("ERROR: "), {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const isDev = env.NODE_ENV === "development";
  let error = err;

  // Ensure AppError
  if (!error.isOperational) {
    error = sendError("Internal server error.", 500);
  }

  // extract values
  const statusCode = error.statusCode || 500;

  const payload = {
    success: false,
    error: {
      message: error.message,
      ...(error.details && { details: error.details }),
    },
  };

  if (isDev) {
    payload.error.originalMessage = error.message;
    payload.error.stack = error.stack;
  }

  res.status(statusCode).json(payload);
};

export default errorMiddleware;
