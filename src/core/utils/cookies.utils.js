import env from "../configs/env.js";

const isProduction = env.NODE_ENV === "production";

const TOKEN_EXPIRATION = {
  ACCESS: 15 * 60 * 1000, // 15 minutes
  REFRESH: 14 * 24 * 60 * 60 * 1000, // 14 days
};

const getBaseCookieConfig = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: "Lax",
});

export const accessCookieConfig = {
  ...getBaseCookieConfig(),
  maxAge: TOKEN_EXPIRATION.ACCESS,
};

export const refreshCookieConfig = {
  ...getBaseCookieConfig(),
  path: "/api/v1/refresh-token",
  maxAge: TOKEN_EXPIRATION.REFRESH,
};

export const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", accessCookieConfig);
  res.clearCookie("refreshToken", refreshCookieConfig);
};
