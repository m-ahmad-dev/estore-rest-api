import ShipmentModel from './shipments.model.js';

export const createShipmentRecord = async (shipmentData, client) => {
  const shipmentRecord = await ShipmentModel.create(
    shipmentData,
    client
  );
  return shipmentRecord;
};

export const findShipmentByOrderId = async (orderId, client) => {
  return await ShipmentModel.findByOrderId(orderId, client);
};

export const updateShippingRecord = async (id, data, client) => {
  return await ShipmentModel.update(id, data, client);
};

export const updateShippingByOrderId = async (
  orderId,
  payload,
  client
) => {
  return await ShipmentModel.updateByOrderId(
    { order_id: orderId },
    payload,
    client
  );
};
