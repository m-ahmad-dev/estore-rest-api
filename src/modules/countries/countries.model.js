import prisma from '../../core/configs/db.js';

const DEFAULT_SELECT = {
  id: true,
  name: true,
  iso2: true,
  iso3: true,
  phone_code: true,
  currency: true,
  flag_emoji: true,
  is_active: true,
  created_at: true,
  updated_at: true,
};

const CountriesModel = {
  findById: async (id, db = prisma) => {
    return db.countries.findUnique({
      where: { id },
      select: DEFAULT_SELECT,
    });
  },

  findMany: async (
    where = {},
    orderBy = { name: 'asc' },
    db = prisma
  ) => {
    return db.countries.findMany({
      where,
      orderBy,
      select: DEFAULT_SELECT,
    });
  },

  updateBy: async (where, data, db = prisma) => {
    return db.countries.update({
      where,
      data,
      select: DEFAULT_SELECT,
    });
  },
};

export default CountriesModel;
