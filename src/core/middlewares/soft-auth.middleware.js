import jwt from 'jsonwebtoken';
import env from '../configs/env.js';
import { extractAccessToken } from '../utils/accessToken.utils.js';

const softAuth = (req, res, next) => {
  try {
    const accessToken = extractAccessToken(req);

    if (!accessToken) {
      req.user = null;
      return next();
    }

    try {
      const payload = jwt.verify(accessToken, env.ACCESS_SECRET);

      req.user = {
        id: payload.id,
        role: payload.role,
      };
    } catch {
      req.user = null;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default softAuth;
