export class AppError extends Error {
  constructor(message, statusCode, details = null, errorCode = null) {
    super(message);

    this.statusCode = statusCode;
    this.details = details;
    this.errorCode = errorCode;
    this.isOperational = true; // Used to distinguish between known app errors and unexpected bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

// A helper to quickly throw an AppError.
export const sendError = (
  message,
  statusCode,
  details = null,
  errorCode = null,
) => {
  return new AppError(message, statusCode, details, errorCode);
};
