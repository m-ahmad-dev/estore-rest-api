import rateLimit from "express-rate-limit";

const baseConfig = {
  standardHeaders: true,
  legacyHeaders: false,
};

// Global API limiter
export const apiLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 50,
  message: { error: "Too many requests" },
});

// Login limiter (strict)
export const loginLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: "Too many login attempts. Try again later." },
});

// Forgot password limiter
export const forgotPasswordLimiter = rateLimit({
  ...baseConfig,
  windowMs: 5 * 60 * 1000,
  limit: 5,
  message: { error: "Too many requests. Try again later." },
});

export const resetPasswordLimiter = rateLimit({
  ...baseConfig,
  windowMs: 5 * 60 * 1000,
  limit: 5,
  message: { error: "Too many attempts. Try again later." },
});
