import env, {
  shippingConfig,
  normalizeShippingProvider,
} from '../../core/configs/env.js';
import AppError from '../../core/utils/error.utils.js';

const DEFAULT_PARCEL = {
  length: '10',
  width: '10',
  height: '10',
  distance_unit: 'cm',
  mass_unit: 'kg',
};

// Helper to get active normalized provider
const getActiveProvider = () =>
  normalizeShippingProvider(shippingConfig.provider);

// 1. Synchronous phase: Checkout ke time sirf rate nikalne ke liye
export const fetchRatesAndLowestRate = async (orderData) => {
  if (!orderData?.customer?.name || !orderData?.address?.street) {
    throw AppError.badRequest(
      'Invalid shipping data: customer name and address are required.'
    );
  }

  const provider = getActiveProvider();

  if (provider === 'MOCK') {
    if (env.NODE_ENV === 'production') {
      throw AppError.internal(
        'SHIPPING_PROVIDER=MOCK is disabled in production. Configure Shippo with a live token.'
      );
    }
    const fee = Number(shippingConfig.shippo.mockShippingFee ?? 0);
    if (!Number.isFinite(fee) || fee < 0) {
      throw AppError.internal(
        'MOCK_SHIPPING_FEE must be a non-negative number.'
      );
    }
    return {
      rateObjectId: null,
      carrier: 'Standard Shipping',
      fee,
      mock: true,
    };
  }

  if (provider !== 'SHIPPO') {
    throw AppError.internal(
      `Unsupported SHIPPING_PROVIDER: ${shippingConfig.provider}`
    );
  }
  if (!shippingConfig.shippo.apiToken) {
    throw AppError.internal(
      'SHIPPO_API_TOKEN is required when SHIPPING_PROVIDER=SHIPPO.'
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

  if (!shipmentData.object_id) {
    throw new Error(
      'Shippo returned a shipment without an object ID.'
    );
  }

  const currency = String(env.STRIPE_CURRENCY || 'pkr').toUpperCase();
  const ratesUrl = `https://api.goshippo.com/shipments/${encodeURIComponent(shipmentData.object_id)}/rates/${encodeURIComponent(currency)}?results=100`;
  let convertedRates = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const convertedResponse = await fetch(ratesUrl, {
      headers: {
        Authorization: `ShippoToken ${shippingConfig.shippo.apiToken}`,
      },
    });
    const convertedData = await convertedResponse.json();
    if (!convertedResponse.ok) {
      throw new Error(
        `Shippo currency conversion failed: ${convertedData.detail || convertedData.error || 'Unable to retrieve rates in store currency.'}`
      );
    }

    const returnedRates = Array.isArray(convertedData)
      ? convertedData
      : convertedData.results || convertedData.rates || [];
    const targetRates = returnedRates.filter(
      (rate) =>
        String(
          rate.currency || rate.amount_currency || ''
        ).toUpperCase() === currency &&
        Number.isFinite(Number(rate.amount)) &&
        Number(rate.amount) >= 0 &&
        rate.object_id
    );
    if (targetRates.length > 0) {
      convertedRates = targetRates;
      break;
    }
    convertedRates = [];

    const statusResponse = await fetch(
      `https://api.goshippo.com/shipments/${encodeURIComponent(shipmentData.object_id)}`,
      {
        headers: {
          Authorization: `ShippoToken ${shippingConfig.shippo.apiToken}`,
        },
      }
    );
    const statusData = await statusResponse.json();
    if (!statusResponse.ok) {
      throw new Error(
        `Shippo shipment status lookup failed: ${statusData.detail || statusData.error || 'Unknown error'}`
      );
    }
    if (statusData.status === 'ERROR') {
      throw new Error(
        'Shippo could not calculate shipping rates for the provided address.'
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (convertedRates.length === 0) {
    throw AppError.badRequest(
      `No shipping rates could be returned in ${currency}. Check Shippo currency support and carrier configuration.`
    );
  }

  const lowestRate = convertedRates.reduce(
    (min, rate) =>
      Number(rate.amount) < Number(min.amount) ? rate : min,
    convertedRates[0]
  );

  return {
    rateObjectId: lowestRate.object_id,
    carrier: lowestRate.provider || 'Shippo Express',
    fee: parseFloat(lowestRate.amount),
  };
};

// 2. Asynchronous background phase: Background processing loop
export const purchaseLabelAsync = async (rateObjectId) => {
  if (!rateObjectId) {
    throw AppError.badRequest(
      'A Shippo rate ID is required to purchase a shipping label.'
    );
  }
  const provider = getActiveProvider();
  if (env.NODE_ENV === 'production' && provider === 'MOCK') {
    throw AppError.internal(
      'Mock shipping is disabled in production.'
    );
  }
  if (provider !== 'SHIPPO' || !shippingConfig.shippo.apiToken) {
    throw AppError.internal(
      'Shipping label purchase requires SHIPPING_PROVIDER=SHIPPO and SHIPPO_API_TOKEN.'
    );
  }
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
  const provider = getActiveProvider();
  if (provider !== 'SHIPPO' || !shippingConfig.shippo.apiToken) {
    throw AppError.internal(
      'Shippo shipment cancellation is not configured.'
    );
  }
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
