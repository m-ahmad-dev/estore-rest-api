import ShipmentModel from './shipments.model.js';
import * as shippoService from './shippo.service.js';

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


/** Purchase a label from the durable rate ID saved during checkout. */
export const purchaseAndPersistShipmentLabel = async (orderId) => {
  const shipment = await ShipmentModel.findByOrderId(orderId);
  if (!shipment || shipment.status !== 'PENDING_LABEL' || !shipment.rate_id) {
    return null;
  }

  // Webhook redeliveries and the retry cron can race. Claim the pending row
  // before calling Shippo so only one worker buys a label for this shipment.
  const claim = await ShipmentModel.claimLabelPurchase(shipment.id);
  if (claim.count !== 1) return null;

  let labelDetails = null;
  let labelPersisted = false;
  try {
    labelDetails = await shippoService.purchaseLabelAsync(shipment.rate_id);
    const completion = await ShipmentModel.completeLabelPurchase(shipment.id, {
      transaction_id: labelDetails.transactionId,
      tracking_number: labelDetails.trackingNumber,
      label_url: labelDetails.labelUrl,
    });

    if (completion.count !== 1) {
      // Cancellation/refund may have changed this shipment while Shippo was
      // creating the label. Try to cancel the orphan label rather than revive
      // the cancelled shipment.
      try {
        await shippoService.cancelShippoShipment(labelDetails.transactionId);
      } catch (cancelError) {
        console.error(
          `[SHIPPO ORPHAN LABEL] Could not cancel label ${labelDetails.transactionId} for order ${orderId}:`,
          cancelError.message
        );
      }
      throw new Error('Shipment state changed while its label was being purchased.');
    }

    labelPersisted = true;
    return await ShipmentModel.findByOrderId(orderId);
  } catch (error) {
    // Retry only if Shippo did not return a purchased label. If it did return a
    // label but DB persistence failed, leave the lease in place for explicit
    // reconciliation rather than risking a second billable label purchase.
    if (!labelDetails && !labelPersisted) {
      await ShipmentModel.releaseLabelPurchaseClaim(shipment.id);
    }
    throw error;
  }
};
