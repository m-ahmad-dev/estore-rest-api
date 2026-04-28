import prisma from "../../core/configs/db.js";

const ADDRESS_SELECT_FIELDS = {
  id: true,
  customer_id: true,
  label: true,
  street: true,
  city: true,
  province: true,
  postal_code: true,
  is_default: true,
};

const AddressModel = {
  insert: async (data, db = prisma) => {
    return await db.addresses.create({
      data,
      select: ADDRESS_SELECT_FIELDS,
    });
  },

  findAll: async (customer_id, db = prisma) => {
    const addresses = await db.addresses.findMany({
      where: { customer_id },
      select: ADDRESS_SELECT_FIELDS,
    });

    return addresses;
  },

  findOne: async (id, db = prisma) => {
    return await db.addresses.findUnique({
      where: { id },
      select: ADDRESS_SELECT_FIELDS,
    });
  },

  edit: async (id, data, db = prisma) => {
    const address = await db.addresses.update({
      where: { id },
      data,
      select: ADDRESS_SELECT_FIELDS,
    });

    return address;
  },

  delete: async (id, db = prisma) => {
    await db.addresses.delete({
      where: { id },
    });
  },

  otherDefaults: async (customer_id, state, db = prisma) => {
    return await db.addresses.updateMany({
      where: {
        customer_id,
        is_default: !state,
      },
      data: { is_default: state },
    });
  },
};

export default AddressModel;
