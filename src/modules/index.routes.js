import express from 'express';

import env from '../core/configs/env.js';
import { apiLimiter } from '../core/middlewares/rateLimiter.js';
import refreshAccessToken from '../modules/token/token.controller.js';

import authRoutes from '../modules/auth/auth.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import customerRoutes from '../modules/customer/customer.routes.js';
import addressRoutes from './address/address.routes.js';
import categoryRoutes from './categories/category.routes.js';
import productRoutes from './products/product.routes.js';
import uploadRoutes from './uploads/upload.routes.js';
import couponRoutes from './coupons/coupons.routes.js';
import cartRoutes from './cart/cart.routes.js';
import orderRoutes from '../modules/orders/order.routes.js';
import wishlistRoutes from '../modules/wishlist/wishlist.routes.js';
import reviewsRoutes from '../modules/reviews/reviews.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import countriesRoutes from '../modules/countries/countries.routes.js';

import prisma from '../core/configs/db.js';

const router = express.Router();

// Global rate limiting for all API routes
router.use('/api', apiLimiter);

// Public informational routes
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to the E-Commerce API Gateway',
    meta: {
      version: '1.0.0',
      environment: env.NODE_ENV || 'development',
      documentation:
        env.POSTMAN_DOCS_URL ||
        'https://documenter.getpostman.com/view/YOUR_COLLECTION_ID',
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
router.get('/health', async (req, res) => {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = process.uptime();

  const uptimeReadable =
    uptimeSeconds > 3600
      ? `${(uptimeSeconds / 3600).toFixed(1)} hours`
      : `${(uptimeSeconds / 60).toFixed(1)} minutes`;

  const healthData = {
    status: 'healthy',
    timestamp,
    uptime: uptimeReadable,
    release: {
      version: process.env.npm_package_version || '1.0.0',
      environment: env.NODE_ENV || 'development',
    },
    services: {
      database: 'connected',
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json(healthData);
  } catch (error) {
    console.error('Health check database failure:', error);
    healthData.status = 'unhealthy';
    healthData.services.database = 'disconnected';
    return res.status(503).json(healthData);
  }
});

// Token refresh (outside versioned router for simplicity)
router.post('/api/v1/refresh-token', refreshAccessToken);

// =============================================
// Versioned API router
// =============================================

const v1Router = express.Router();

v1Router.use('/auth', authRoutes);
v1Router.use('/admin/admins', adminRoutes);
v1Router.use('/admin/uploads', uploadRoutes);
v1Router.use('/admin/coupons', couponRoutes);
v1Router.use('/admin/dashboard', dashboardRoutes);

v1Router.use('/cart', cartRoutes);
v1Router.use('/wishlist', wishlistRoutes);

// Shared routes (admin + customer + public)
v1Router.use('/', customerRoutes);
v1Router.use('/', addressRoutes);
v1Router.use('/', categoryRoutes);
v1Router.use('/', productRoutes);
v1Router.use('/', orderRoutes);
v1Router.use('/', reviewsRoutes);
v1Router.use('/', countriesRoutes);

// Mount versioned router
router.use('/api/v1', v1Router);

export default router;
