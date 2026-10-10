import env from '../configs/env.js';

const isProduction = env.NODE_ENV === 'production';

const TOKEN_EXPIRATION = {
  ACCESS: 15 * 60 * 1000, // 15 minutes
  REFRESH: 14 * 24 * 60 * 60 * 1000, // 14 days
};

/**
 * SameSite policy (env: COOKIE_SAME_SITE = lax | strict | none, default lax)
 * - lax/strict : frontend and API are SAME-SITE (same registrable domain, e.g.
 *                admin.example.com + api.example.com) or served via a reverse proxy.
 * - none       : frontend and API are on DIFFERENT sites (e.g. *.vercel.app +
 *                *.railway.app). Browsers then REQUIRE `Secure`; it is forced below.
 */
const SAME_SITE = { lax: 'Lax', strict: 'Strict', none: 'None' };
const sameSite = SAME_SITE[(env.COOKIE_SAME_SITE || 'lax').toLowerCase()] || 'Lax';

// Optional, e.g. ".example.com" to share cookies between subdomains.
const cookieDomain = env.COOKIE_DOMAIN?.trim() || undefined;

// Base cookie configuration
export const getBaseCookieConfig = (overrides = {}) => ({
  httpOnly: true,
  secure: isProduction || sameSite === 'None',
  sameSite,
  ...(cookieDomain ? { domain: cookieDomain } : {}),
  ...overrides,
});

export const accessCookieConfig = getBaseCookieConfig({
  maxAge: TOKEN_EXPIRATION.ACCESS,
});

export const refreshCookieConfig = getBaseCookieConfig({
  maxAge: TOKEN_EXPIRATION.REFRESH,
  path: '/api/v1/refresh-token',
});

export const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', accessCookieConfig);
  res.clearCookie('refreshToken', refreshCookieConfig);
};
