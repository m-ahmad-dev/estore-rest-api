import { tryCatch } from "../../core/utils/trycatch.js";

// Compares requested permissions against what exists in the database.
export const checkExistPermission = tryCatch((requested, existing) => {
  const missing = requested.filter((p) => !existing.includes(p));

  return missing.length === 0 ? true : missing;
});
