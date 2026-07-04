import jwt from 'jsonwebtoken';
import env from '../configs/env.js';

const softAuth = (req, res, next) => {
  try {
    const accessToken = req.cookies?.accessToken;

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
