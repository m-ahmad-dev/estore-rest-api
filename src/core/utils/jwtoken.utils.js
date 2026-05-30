import jwt from 'jsonwebtoken';
import env from '../configs/env.js';

// Generates short-lived token (15m) for API requests
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.ACCESS_SECRET, {
    expiresIn: 900,
  });
};

// Generates long-lived token (14d) for session persistence
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.REFRESH_SECRET, {
    expiresIn: '14d',
  });
};
