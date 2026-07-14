import express from 'express';
import auth from '../../core/middlewares/auth.middleware.js';
import authorizePermission from '../../core/middlewares/pbac.middleware.js';
import validate from '../../core/middlewares/input_validate.middleware.js';

import * as countriesController from './countries.controller.js';
import * as countriesSchema from './countries.validation.js';

const router = express.Router();

/** Public endpoint - Active countries only */
router.get('/countries', countriesController.getActiveCountries);

/** Admin endpoints */
router.get(
  '/admin/countries',
  auth,
  authorizePermission('countries.view'),
  validate(countriesSchema.getAllCountriesSchema, 'query'),
  countriesController.getAllCountriesAdmin
);

router.patch(
  '/admin/countries/:id/status',
  validate(countriesSchema.checkCountryIdSchema, 'params'),
  auth,
  authorizePermission('countries.edit'),
  validate(countriesSchema.toggleStatusSchema, 'body'),
  countriesController.updateCountryStatus
);

export default router;
