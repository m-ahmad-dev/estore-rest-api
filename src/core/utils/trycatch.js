// Wrapper for that receive (req, res, next) to remove repeatition of tryCatch.
export const asyncWrapper = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
