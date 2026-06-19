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

const app = express();

app.set('trust proxy', 1);

app.post(
  '/api/v1/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Passport initialize
app.use(passport.initialize());
// Load Passport Config (Strategy registration)
import './core/configs/passport.js';

if (env.NODE_ENV === 'production') {
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
}

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.disable('x-powered-by');

app.use(routes);

// 404 route error.
app.all('/*path', (req, res, next) => {
  next(AppError.routeNotFound(req.originalUrl));
});

app.use(errorMiddleware);

export default app;
