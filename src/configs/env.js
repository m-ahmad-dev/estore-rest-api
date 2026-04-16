import "dotenv/config";

const env = {
  // Application configuration:
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV,
  // Database:
  DATABASE_URL: process.env.DATABASE_URL,
  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  SALT_ROUNDS: process.env.SALT_ROUNDS,
  ACCESS_SECRET: process.env.ACCESS_SECRET,
  REFRESH_SECRET: process.env.REFRESH_SECRET,
  // Owner for testing:
  OWNER_EMAIL: process.env.OWNER_EMAIL,
  OWNER_PASSWORD: process.env.OWNER_PASSWORD,
  OWNER_NAME: process.env.OWNER_NAME,
  // CORS
  FRONTEND_URL: process.env.FRONTEND_URL,
  // Google auth cedentials:
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  CALLBACK_URL: process.env.CALLBACK_URL,
};

export default env;
