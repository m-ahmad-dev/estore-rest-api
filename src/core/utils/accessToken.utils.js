/**
 * Reads the access token from the request.
 *
 * 1. `Authorization: Bearer <token>`  -> SPAs (admin panel): token kept in memory,
 *    works cross-origin and is not affected by SameSite / third-party-cookie rules.
 * 2. `accessToken` httpOnly cookie    -> fallback (storefront / Postman / same-site).
 *
 * The header wins on purpose: admin and customer share the same cookie names on the
 * same API host, so a customer cookie must never shadow an explicit admin Bearer token.
 */
export const extractAccessToken = (req) => {
  const header = req.headers?.authorization;

  if (typeof header === 'string') {
    const [scheme, value] = header.trim().split(/\s+/);
    if (scheme?.toLowerCase() === 'bearer' && value) {
      return value;
    }
  }

  return req.cookies?.accessToken || null;
};
