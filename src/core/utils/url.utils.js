import env from "../configs/env.js";

// Backblaze key to URL:
export const getCDNUrl = (key) => {
  if (!key) return null;
  return `${env.IMAGE_BASE_URL}/${key}`;
};
