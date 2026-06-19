import prisma from '../../core/configs/db.js';

const ShipmentModel = {
  async create(data, db = prisma) {
    return db.shipments.create({ data });
  },
};

export default ShipmentModel;
