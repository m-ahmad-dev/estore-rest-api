import refreshTokenService from './token.service.js';
import { accessCookieConfig } from '../../core/utils/cookies.utils.js';
import AppError from '../../core/utils/error.utils.js';
import { findAdminById } from '../admin/admin.service.js';
import { adminPermissions } from '../permissions/permissions.service.js';

const ADMIN_ROLES = new Set(['admin', 'owner']);

const refreshAccessToken = async (req, res, next) => {
  const refreshToken = req.cookies?.refreshToken;

  try {
    const result = await refreshTokenService(refreshToken);

    // Set Cookie (kept for cookie-based clients such as the storefront / Postman)
    res.cookie('accessToken', result.accessToken, accessCookieConfig);

    const body = {
      success: true,
      message: 'Access token refreshed successfully',
      accessToken: result.accessToken,
      user: result.user,
    };

    // Admin SPA needs the profile + permissions after a page reload; the login
    // response is gone by then, so return the same shape as the login response.
    if (ADMIN_ROLES.has(result.user.role)) {
      const adminRecord = await findAdminById(result.user.id);

      if (!adminRecord || adminRecord.is_active === false) {
        throw AppError.forbidden('Your account is disabled');
      }

      // eslint-disable-next-line no-unused-vars
      const { password_hash, ...admin } = adminRecord;
      const permissions = await adminPermissions(admin.id);

      body.admin = { ...admin, permissions };
    }

    return res.status(200).json(body);
  } catch (error) {
    // Handle if custom refresh-token error.
    if (error.errorCode === 'REFRESH_TOKEN_EXPIRED') {
      return next(AppError.forbidden('Access Forbidden'));
    }
    next(error);
  }
};

export default refreshAccessToken;
