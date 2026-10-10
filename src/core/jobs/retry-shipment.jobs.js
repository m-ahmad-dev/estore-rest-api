import cron from 'node-cron';
import prisma from '../configs/db.js';
import env from '../configs/env.js';
import * as shipmentService from '../../modules/shipments/shipments.service.js';

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
    const stalePurchases = await prisma.shipments.findMany({
      where: {
        status: 'PURCHASING_LABEL',
        label_purchase_started_at: { lt: new Date(Date.now() - 20 * 60 * 1000) },
      },
      select: { id: true, order_id: true, label_purchase_started_at: true },
      take: 20,
    });
    for (const shipment of stalePurchases) {
      console.error(
        `[CRON ACTION REQUIRED] Shipment ${shipment.id} for order ${shipment.order_id} has an interrupted label purchase lease since ${shipment.label_purchase_started_at?.toISOString() || 'an unknown time'}. Reconcile Shippo before retrying to avoid buying a duplicate label.`
      );
    }

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

        // Never buy a label for an unpaid card order. Checkout can be retried,
        // and a carrier label is a billable external side effect.
        if (
          shipment.order?.payment_method === 'CARD' &&
          shipment.order?.payment_status !== 'PAID'
        ) {
          continue;
        }

        if (!shipment.rate_id) {
          failed++;
          console.error(
            `[CRON ERROR] Shipment ${shipment.id} has no saved Shippo rate ID; label cannot be recovered automatically.`
          );
          continue;
        }

        // Purchase using the persisted carrier rate, never the order UUID.
        const labelDetails = await shipmentService.purchaseAndPersistShipmentLabel(
          shipment.order_id
        );
        if (labelDetails?.tracking_number || labelDetails?.trackingNumber) {
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
  const fallbackSchedule = '*/15 * * * *';
  const configuredSchedule = env.SHIPMENT_RETRY_SCHEDULE;
  const schedule = configuredSchedule && cron.validate(configuredSchedule)
    ? configuredSchedule
    : fallbackSchedule;
  if (configuredSchedule && schedule !== configuredSchedule) {
    console.warn(`[CRON CONFIG] Invalid SHIPMENT_RETRY_SCHEDULE; using ${fallbackSchedule}.`);
  }

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
