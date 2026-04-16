//Generic error wrapper to handle both sync and async errors.
export const tryCatch = (fn) => {
  return (...args) => {
    try {
      const result = fn(...args);

      if (result instanceof Promise) {
        return result.catch((error) => {
          throw error; // Forward async errors
        });
      }

      return result;
    } catch (error) {
      throw error; // Forward sync errors
    }
  };
};

// Wrapper for that receive (req, res, next) to remove repeatition of tryCatch.
export const asyncWrapper = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
