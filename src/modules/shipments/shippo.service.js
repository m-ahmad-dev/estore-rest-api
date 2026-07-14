import { shippingConfig } from '../../core/configs/env.js';
import AppError from '../../core/utils/error.utils.js';

const DEFAULT_PARCEL = {
  length: '10',
  width: '10',
  height: '10',
  distance_unit: 'cm',
  mass_unit: 'kg',
};

// 1. Synchronous phase: Checkout ke time sirf rate nikalne ke liye
export const fetchRatesAndLowestRate = async (orderData) => {
  if (!orderData?.customer?.name || !orderData?.address?.street) {
    throw AppError.badRequest(
      'Invalid shipping data: customer name and address are required.'
    );
  }

  const shipmentResponse = await fetch(
    'https://api.goshippo.com/shipments',
    {
      method: 'POST',
      headers: {
        Authorization: `ShippoToken ${shippingConfig.shippo.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address_from: shippingConfig.shippo.senderAddress,
        address_to: {
          name: orderData.customer.name,
          street1: orderData.address.street,
          city: orderData.address.city,
          state: orderData.address.state || '',
          zip: orderData.address.postal_code || '',
          country: orderData.address.country_code,
          phone: orderData.customer.phone,
          email: orderData.customer.email,
        },
        parcels: [
          {
            ...DEFAULT_PARCEL,
            weight:
              orderData.totalWeight > 0
                ? orderData.totalWeight.toString()
                : '1',
          },
        ],
        async: false,
      }),
    }
  );

  const shipmentData = await shipmentResponse.json();

  if (!shipmentResponse.ok) {
    throw new Error(
      `Shippo Shipment API error: ${shipmentData.error || 'Unknown error'}`
    );
  }

  const rates = shipmentData.rates || [];
  if (rates.length === 0) {
    throw new Error(
      'No shipping rates found for the provided address routing.'
    );
  }

  const lowestRate = rates.reduce(
    (min, rate) =>
      Number(rate.amount) < Number(min.amount) ? rate : min,
    rates[0]
  );

  return {
    rateObjectId: lowestRate.object_id,
    carrier: lowestRate.provider || 'Shippo Express',
    fee: parseFloat(lowestRate.amount),
  };
};

// 2. Asynchronous background phase: Background processing loop
export const purchaseLabelAsync = async (rateObjectId) => {
  const transactionResponse = await fetch(
    'https://api.goshippo.com/transactions',
    {
      method: 'POST',
      headers: {
        Authorization: `ShippoToken ${shippingConfig.shippo.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rate: rateObjectId,
        label_file_type: 'PDF',
        async: false,
      }),
    }
  );

  let transactionData = await transactionResponse.json();

  if (!transactionResponse.ok) {
    const detailedError =
      transactionData.messages && transactionData.messages.length > 0
        ? transactionData.messages[0].text
        : transactionData.error || 'Unknown error';
    throw new Error(`Shippo Label Purchase failed: ${detailedError}`);
  }

  let status = transactionData.status;
  let retries = 5;

  while (
    (status === 'QUEUED' ||
      status === 'WAITING' ||
      !transactionData.label_url) &&
    retries > 0
  ) {
    console.info(
      `[SHIPPO ASYNC] Label is queued/processing. Retrying... (${retries} attempts left)`
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const pollResponse = await fetch(
      `https://api.goshippo.com/transactions/${transactionData.object_id}`,
      {
        headers: {
          Authorization: `ShippoToken ${shippingConfig.shippo.apiToken}`,
        },
      }
    );

    transactionData = await pollResponse.json();
    status = transactionData.status;
    retries--;
  }

  if (
    status === 'ERROR' ||
    !transactionData.label_url ||
    !transactionData.tracking_number
  ) {
    throw new Error(
      'Shippo transaction completed but tracking data is missing from carrier.'
    );
  }

  return {
    transactionId: transactionData.object_id,
    trackingNumber: transactionData.tracking_number,
    labelUrl: transactionData.label_url,
  };
};

export const cancelShippoShipment = async (shippoTransactionId) => {
  if (!shippoTransactionId) {
    throw AppError.badRequest(
      'No valid identifier found for shipment cancellation.'
    );
  }

  try {
    const response = await fetch('https://api.goshippo.com/refunds', {
      method: 'POST',
      headers: {
        Authorization: `ShippoToken ${shippingConfig.shippo.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: shippoTransactionId,
        async: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMessage = data.message || data.error || '';
      // Safe check for sandbox environment rejections
      if (
        errMessage.toLowerCase().includes('rejected') ||
        response.status === 400
      ) {
        console.warn(
          `[SHIPPO WARN] Refund rejected by sandbox for transaction: ${shippoTransactionId}`
        );
        throw new Error(
          `[SHIPPO WARN] Refund rejected by sandbox for transaction: ${shippoTransactionId}`
        );
      }
      throw new Error(
        errMessage || 'Shippo refund request was rejected.'
      );
    }

    return {
      success: true,
      status: data.status,
      refundId: data.id,
    };
  } catch (error) {
    console.error(
      `[SHIPPO ERROR] Cancellation failed for ${shippoTransactionId}:`,
      error.message
    );
    throw error;
  }
};
