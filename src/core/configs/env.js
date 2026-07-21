import 'dotenv/config';

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
  // Gmail configs:
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  EMAIL_FROM: process.env.GMAIL_USER,
  // crons cleanup configs:
  CLEANUP_SCHEDULE: process.env.CLEANUP_SCHEDULE,
  SHIPMENT_RETRY_SCHEDULE: process.env.SHIPMENT_RETRY_SCHEDULE,
  // Backblaze Credentials:
  B2_ENDPOINT: process.env.B2_ENDPOINT,
  B2_REGION: process.env.B2_REGION,
  B2_KEY_ID: process.env.B2_KEY_ID,
  B2_APP_KEY: process.env.B2_APP_KEY,
  B2_BUCKET_NAME: process.env.B2_BUCKET_NAME,
  IMAGE_BASE_URL: process.env.IMAGE_BASE_URL,

  // Postman Docs URL
  POSTMAN_DOCS_URL: process.env.POSTMAN_DOCS_URL,
};

export default env;

// Shipping configuration:
export const shippingConfig = {
  provider: process.env.SHIPPING_PROVIDER || 'MOCK',
  shippo: {
    apiToken: process.env.SHIPPO_API_TOKEN,
    senderAddress: {
      name: process.env.SENDER_NAME,
      street1: process.env.SENDER_STREET,
      city: process.env.SENDER_CITY,
      state: process.env.SENDER_STATE,
      zip: process.env.SENDER_POSTAL_CODE,
      country: process.env.SENDER_COUNTRY,
      phone: process.env.SENDER_PHONE,
      email: process.env.SENDER_EMAIL,
    },
  },
};
