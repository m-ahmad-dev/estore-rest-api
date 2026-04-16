import chalk from "chalk";
import env from "../configs/env.js";
import { AppError } from "../utils/error.utils.js";

const errorMiddleware = (err, req, res, next) => {
  const isDev = env.NODE_ENV === "development";

  // Normalize error
  let error = err;

  if (!(error instanceof AppError)) {
    error = AppError.internal();
  }

  // Logging (always full log internally)
  console.error(chalk.red.bold("ERROR:"), {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const response = {
    success: false,
    error: {
      code: error.errorCode,
      message: error.message,
      ...(error.details && { details: error.details }),
    },
  };

  if (isDev) {
    response.error.stack = err.stack;
  }

  res.status(error.statusCode).json(response);
};

export default errorMiddleware;
