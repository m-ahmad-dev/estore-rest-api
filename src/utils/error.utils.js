export class AppError extends Error {
  constructor(message, statusCode, options = {}) {
    super(message);

    this.statusCode = statusCode;
    this.errorCode = options.errorCode || "INTERNAL_ERROR";
    this.details = options.details || null;
    this.isOperational = options.isOperational ?? true;

    Error.captureStackTrace(this, this.constructor);
  }

  // 400
  static badRequest(message = "Bad request", details = null) {
    return new AppError(message, 400, {
      errorCode: "BAD_REQUEST",
      details,
    });
  }

  static validationError(details) {
    return new AppError("Validation failed", 400, {
      errorCode: "VALIDATION_ERROR",
      details,
    });
  }

  // 401
  static unauthorized(message = "Unauthorized") {
    return new AppError(message, 401, {
      errorCode: "UNAUTHORIZED",
    });
  }

  // 403
  static forbidden(message = "Forbidden") {
    return new AppError(message, 403, {
      errorCode: "FORBIDDEN",
    });
  }

  // 404
  static notFound(resource = "Resource") {
    return new AppError(`${resource} not found`, 404, {
      errorCode: "NOT_FOUND",
    });
  }

  static routeNotFound(url = null) {
    return new AppError(url ? `Cannot find ${url}` : "Route not found", 404, {
      errorCode: "ROUTE_NOT_FOUND",
      details: url ? { url } : null,
    });
  }

  // 409
  static conflict(message = "Conflict", details = null) {
    return new AppError(message, 409, {
      errorCode: "CONFLICT",
      details,
    });
  }

  // 429
  static tooManyRequests(message = "Too many requests") {
    return new AppError(message, 429, {
      errorCode: "RATE_LIMITED",
    });
  }

  // 500
  static internal(message = "Internal server error") {
    return new AppError(message, 500, {
      errorCode: "INTERNAL_ERROR",
      isOperational: false,
    });
  }

  // JWT / Auth specific
  static invalidToken() {
    return new AppError("Invalid or expired token", 401, {
      errorCode: "INVALID_TOKEN",
    });
  }
}
