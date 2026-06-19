import ShipmentModel from './shipments.model.js';

export const createShipmentRecord = async (orderId, shipmentData) => {
  const shipmentRecord = await ShipmentModel.create(shipmentData);
  return shipmentRecord;
};

