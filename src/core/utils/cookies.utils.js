import env from '../configs/env.js';

const isProduction = env.NODE_ENV === 'production';

const TOKEN_EXPIRATION = {
  ACCESS: 15 * 60 * 1000, // 15 minutes
  REFRESH: 14 * 24 * 60 * 60 * 1000, // 14 days
};

// Base cookie configuration
export const getBaseCookieConfig = (overrides = {}) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'Lax',
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
