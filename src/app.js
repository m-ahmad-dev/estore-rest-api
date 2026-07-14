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

// Security
app.disable('x-powered-by');

if (env.NODE_ENV === 'production') {
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled for decoupled frontend SPA
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
}

// CORS
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Passport initialization
app.use(passport.initialize());

/* Routes */

// Main application routes
app.use(routes);

// 404 handler for undefined routes
app.all('*', (req, res, next) => {
  next(AppError.routeNotFound(req.originalUrl));
});

// Global error handler
app.use(errorMiddleware);

export default app;
