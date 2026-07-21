import cron from 'node-cron';
import prisma from '../configs/db.js';
import env from '../configs/env.js';
import * as shipmentService from '../../modules/shipments/shipments.service.js';
import * as shippoService from '../../modules/shipments/shippo.service.js';

export const retryPendingShipmentLabels = async () => {
  try {
    const pendingShipments = await prisma.shipments.findMany({
      where: {
        status: 'PENDING_LABEL',
      },
      include: {
        order: true,
      },
      take: 20,
    });

    if (pendingShipments.length === 0) {
      return { processed: 0, recovered: 0, failed: 0 };
    }

    let recovered = 0;
    let failed = 0;

    for (const shipment of pendingShipments) {
      try {
        if (shipment.order?.status === 'CANCELLED') {
          await shipmentService.updateShippingRecord(shipment.id, {
            status: 'CANCELLED',
          });
          continue;
        }

        // Purchase or recover label details via Shippo service
        const labelDetails =
          await shippoService.purchaseLabelForOrder(
            shipment.order_id
          );

        if (labelDetails?.trackingNumber) {
          await shipmentService.updateShippingRecord(shipment.id, {
            transaction_id: labelDetails.transactionId,
            tracking_number: labelDetails.trackingNumber,
            label_url: labelDetails.labelUrl,
            status: 'PROCESSING',
          });
          recovered++;
        }
      } catch (err) {
        failed++;
        console.error(
          `[CRON ERROR] Failed to recover label for Shipment ${shipment.id} (Order ${shipment.order_id}):`,
          err.message
        );
      }
    }

    return { processed: pendingShipments.length, recovered, failed };
  } catch (error) {
    console.error(
      '[CRON CRITICAL] Shipment label retry job failed:',
      error
    );
    throw error;
  }
};

/**
 * Initializes the shipment label retry cron schedule.
 */
const startShipmentRetryJob = () => {
  const schedule = env.SHIPMENT_RETRY_SCHEDULE || '*/15 * * * *';

  cron.schedule(schedule, async () => {
    try {
      const result = await retryPendingShipmentLabels();
      if (result.processed > 0) {
        console.log(
          `[CRON] Shipment Labels — Processed: ${result.processed}, Recovered: ${result.recovered}, Failed: ${result.failed}`
        );
      }
    } catch (err) {
      console.error(
        '[CRON] Shipment label recovery run failed:',
        err
      );
    }
  });
};

export default startShipmentRetryJob;
