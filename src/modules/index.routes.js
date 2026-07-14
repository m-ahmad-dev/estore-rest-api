import express from 'express';
import { apiLimiter } from '../core/middlewares/rateLimiter.js';
import seedOwner from '../core/seeds/owner.seed.js';
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

const routes = express.Router();

routes.use('/api', apiLimiter);

await seedOwner(); // Ensure owner is seeded before the server starts.

routes.get('/health', (req, res) => res.json({ status: 'healthy' }));
routes.post('/api/v1/refresh-token', refreshAccessToken);

routes.use('/api/v1/auth', authRoutes);
routes.use('/api/v1/admin/admins', adminRoutes);
routes.use('/api/v1', customerRoutes);
routes.use('/api/v1', addressRoutes);
routes.use('/api/v1', categoryRoutes);
routes.use('/api/v1/admin/uploads', uploadRoutes);
routes.use('/api/v1', productRoutes);
routes.use('/api/v1/admin/coupons', couponRoutes);
routes.use('/api/v1/cart', cartRoutes);
routes.use('/api/v1', orderRoutes);
routes.use('/api/v1/wishlist', wishlistRoutes);
routes.use('/api/v1', reviewsRoutes);
routes.use('/api/v1/admin/dashboard', dashboardRoutes);
routes.use('/api/v1', countriesRoutes);

export default routes;
