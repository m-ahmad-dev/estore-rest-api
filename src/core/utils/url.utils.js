import env from "../configs/env.js";

const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
};

/** The storefront URL is deliberately separate from the CORS origin list. */
export const getStorefrontUrl = () => {
  const explicitStorefront = normalizeBaseUrl(env.STORE_FRONTEND_URL);
  if (explicitStorefront) return explicitStorefront;
  if (env.NODE_ENV === 'production') return null;
  return normalizeBaseUrl((env.FRONTEND_URL || '').split(',')[0]) || 'http://localhost:5173';
};

export const getAllowedFrontendOrigins = () => {
  const candidates = [
    ...(env.FRONTEND_URL || '').split(','),
    env.STORE_FRONTEND_URL,
    env.ADMIN_FRONTEND_URL,
  ];
  return [...new Set(candidates.map(normalizeBaseUrl).filter(Boolean))];
};

// Backblaze key to URL:
export const getCDNUrl = (key) => {
  if (!key) return null;
  return `${env.IMAGE_BASE_URL}/${key}`;
};
