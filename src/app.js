import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import cookieParser from 'cookie-parser';

import env from './core/configs/env.js';
import routes from './modules/index.routes.js';
import AppError from './core/utils/error.utils.js';
import errorMiddleware from './core/middlewares/error.middleware.js';
import { handleStripeWebhook } from './modules/payment/payment.webhook.js';
import { getAllowedFrontendOrigins } from './core/utils/url.utils.js';

// Load Passport strategies
import './core/configs/passport.js';

const app = express();

// Trust reverse proxies (Nginx, Cloudflare, load balancers, etc.)
app.set('trust proxy', 1);

// Stripe webhook
app.post(
  '/api/v1/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

/* Global Middlewares */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security headers are enabled in every environment. A decoupled SPA needs
// its own CSP, so API responses do not set a restrictive CSP here.
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS: normalize and validate origins instead of relying on an unguarded split.
const allowedOrigins = new Set(getAllowedFrontendOrigins());
app.use(
  cors({
    origin(origin, callback) {
      // Requests without Origin are server-to-server / health-check requests.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Passport initialization
app.use(passport.initialize());

/* Routes */

// Main application routes
app.use(routes);

// 404 handler for undefined routes
app.all('/{*any}', (req, res, next) => {
  next(AppError.routeNotFound(req.originalUrl));
});

// Global error handler
app.use(errorMiddleware);

export default app;
