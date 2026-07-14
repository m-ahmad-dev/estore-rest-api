import * as countriesService from './countries.service.js';
import { asyncWrapper } from '../../core/utils/trycatch.js';

export const getAllCountriesAdmin = asyncWrapper(async (req, res) => {
  const result = await countriesService.getAllCountries(req.query);
  res.status(200).json(result);
});

export const updateCountryStatus = asyncWrapper(async (req, res) => {
  const result = await countriesService.updateCountryStatus(
    req.params.id,
    req.body.is_active
  );
  
  res.status(200).json(result);
});

export const getActiveCountries = asyncWrapper(async (req, res) => {
  const result = await countriesService.getActiveCountries();
  res.status(200).json(result);
});
