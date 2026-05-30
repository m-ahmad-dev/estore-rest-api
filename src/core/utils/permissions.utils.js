// Compares requested permissions against what exists in the database.
export const checkExistPermission = (requested, existing) => {
  const missing = requested.filter((p) => !existing.includes(p));

  return missing.length === 0 ? true : missing;
};
