import executeTransaction from '../../core/utils/dbTransaction.js';
import AppError from '../../core/utils/error.utils.js';
import CountriesModel from './countries.model.js';

/**
 * Transform country entity for API responses.
 */
const buildResponse = (country) => ({
  id: country.id,
  name: country.name,
  code: {
    iso2: country.iso2,
    iso3: country.iso3,
  },
  phone_code: country.phone_code,
  currency: country.currency,
  flag_emoji: country.flag_emoji,
  is_active: country.is_active,
  updated_at: country.updated_at,
});

export const getAllCountries = async (query) => {
  const { search, is_active, order = 'asc' } = query;

  const where = {};

  if (is_active !== undefined) {
    where.is_active = is_active;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { iso2: { contains: search, mode: 'insensitive' } },
      { iso3: { contains: search, mode: 'insensitive' } },
    ];
  }

  const countries = await CountriesModel.findMany(where, {
    name: order,
  });

  return {
    success: true,
    message: 'Countries retrieved successfully.',
    meta: { total: countries.length },
    countries: countries.map(buildResponse),
  };
};

export const updateCountryStatus = async (countryId, isActive) => {
  return executeTransaction(async (client) => {
    const country = await CountriesModel.findById(countryId, client);

    if (!country) {
      throw AppError.notFound('Country');
    }

    // No-op if status is unchanged
    if (country.is_active === isActive) {
      return {
        success: true,
        message: 'Country status is already up to date.',
        country: buildResponse(country),
      };
    }

    const updatedCountry = await CountriesModel.updateBy(
      { id: countryId },
      { is_active: isActive },
      client
    );

    return {
      success: true,
      message: 'Country status updated successfully.',
      country: buildResponse(updatedCountry),
    };
  });
};

export const getActiveCountries = async () => {
  const countries = await CountriesModel.findMany(
    { is_active: true },
    { name: 'asc' }
  );

  return {
    success: true,
    message: 'Active countries retrieved successfully.',
    countries: countries.map(buildResponse),
  };
};
