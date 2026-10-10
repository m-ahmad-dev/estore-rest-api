import prisma from '../../core/configs/db.js';

const SHIPMENT_SELECT_FIELDS = {
  id: true,
  order_id: true,
  carrier: true,
  tracking_number: true,
  transaction_id: true,
  rate_id: true,
  label_purchase_started_at: true,
  label_url: true,
  status: true,
  shipped_at: true,
  delivered_at: true,
};

const ShipmentModel = {
  create: async (data, db = prisma) => {
    return await db.shipments.create({
      data,
      select: SHIPMENT_SELECT_FIELDS,
    });
  },

  findByOrderId: async (orderId, db = prisma) => {
    return await db.shipments.findFirst({
      where: { order_id: orderId },
      select: SHIPMENT_SELECT_FIELDS,
    });
  },

  update: async (id, data, db = prisma) => {
    return await db.shipments.update({
      where: { id },
      data,
      select: SHIPMENT_SELECT_FIELDS,
    });
  },

  updateByOrderId: async (where = {}, data, db = prisma) => {
    return await db.shipments.updateMany({
      where,
      data,
    });
  },

  claimLabelPurchase: async (id, db = prisma) =>
    db.shipments.updateMany({
      where: {
        id,
        status: 'PENDING_LABEL',
        transaction_id: null,
        rate_id: { not: null },
      },
      data: {
        status: 'PURCHASING_LABEL',
        label_purchase_started_at: new Date(),
      },
    }),

  completeLabelPurchase: async (id, data, db = prisma) =>
    db.shipments.updateMany({
      where: { id, status: 'PURCHASING_LABEL' },
      data: {
        ...data,
        status: 'PROCESSING',
        label_purchase_started_at: null,
      },
    }),

  releaseLabelPurchaseClaim: async (id, db = prisma) =>
    db.shipments.updateMany({
      where: { id, status: 'PURCHASING_LABEL' },
      data: {
        status: 'PENDING_LABEL',
        label_purchase_started_at: null,
      },
    }),
};

export default ShipmentModel;
