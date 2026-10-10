import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
process.env.FRONTEND_URL = 'https://shop.example.test/path, https://admin.example.test/dashboard,invalid-origin';
process.env.STORE_FRONTEND_URL = 'https://shop.example.test/store';
process.env.ADMIN_FRONTEND_URL = 'https://admin.example.test/admin';

const { getAllowedFrontendOrigins, getStorefrontUrl } = await import('../src/core/utils/url.utils.js');

test('storefront redirect URL is normalized to the storefront origin', () => {
  assert.equal(getStorefrontUrl(), 'https://shop.example.test');
});

test('CORS origin configuration normalizes, validates, and deduplicates origins', () => {
  assert.deepEqual(getAllowedFrontendOrigins(), [
    'https://shop.example.test',
    'https://admin.example.test',
  ]);
});
