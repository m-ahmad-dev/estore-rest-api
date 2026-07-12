import express from 'express';
import auth from '../../core/middlewares/auth.middleware.js';
import authorizePermission from '../../core/middlewares/pbac.middleware.js';
import validate from '../../core/middlewares/input_validate.middleware.js';
import * as dashboardController from './dashboard.controller.js';
import { periodQuerySchema } from './dashboard.validation.js';

const router = express.Router();

router.get(
  '/',
  auth,
  authorizePermission('dashboard.view'),
  dashboardController.viewDashboard
);

router.get(
  '/stats',
  auth,
  authorizePermission('dashboard.view'),
  validate(periodQuerySchema, 'query'),
  dashboardController.viewStats
);

router.get(
  '/charts',
  auth,
  authorizePermission('dashboard.view'),
  validate(periodQuerySchema, 'query'),
  dashboardController.viewCharts
);

router.get(
  '/alerts',
  auth,
  authorizePermission('dashboard.view'),
  dashboardController.viewAlerts
);

router.get(
  '/activity',
  auth,
  authorizePermission('dashboard.view'),
  dashboardController.viewActivity
);

export default router;
