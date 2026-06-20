import jwt from 'jsonwebtoken';
import env from '../configs/env.js';

const softAuth = (req, res, next) => {
  try {
    const accessToken = req.cookies?.access_token;

    if (!accessToken) {
      req.user = null;
      return next();
    }

    try {
      const payload = jwt.verify(accessToken, env.ACCESS_SECRET);
      req.user = {
        id: payload.sub,
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
