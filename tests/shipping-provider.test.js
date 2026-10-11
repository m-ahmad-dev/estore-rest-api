import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SHIPPING_PROVIDER = 'SHIPPO EXPRESS';
process.env.NODE_ENV = 'development';
delete process.env.SHIPPO_API_TOKEN;

const { normalizeShippingProvider, shippingConfig } = await import(
  '../src/core/configs/env.js'
);
const { fetchRatesAndLowestRate } = await import(
  '../src/modules/shipments/shippo.service.js'
);

test('normalizes SHIPPO EXPRESS to the live Shippo integration', () => {
  assert.equal(normalizeShippingProvider('SHIPPO EXPRESS'), 'SHIPPO');
  assert.equal(normalizeShippingProvider(' shippo express '), 'SHIPPO');
  assert.equal(shippingConfig.provider, 'SHIPPO');
});

test('does not silently fall back to mock shipping for SHIPPO EXPRESS', async () => {
  await assert.rejects(
    fetchRatesAndLowestRate({
      customer: { name: 'Test Customer' },
      address: { street: '1 Test Street' },
    }),
    /SHIPPO_API_TOKEN is required when SHIPPING_PROVIDER=SHIPPO/
  );
});

test('normalizes other provider names without accepting unknown providers', () => {
  assert.equal(normalizeShippingProvider(' mock '), 'MOCK');
  assert.equal(normalizeShippingProvider('unknown carrier'), 'UNKNOWN CARRIER');
});
