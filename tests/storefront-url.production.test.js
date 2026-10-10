import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
process.env.FRONTEND_URL = 'https://admin.example.test,https://shop.example.test';
delete process.env.STORE_FRONTEND_URL;

const { getStorefrontUrl } = await import('../src/core/utils/url.utils.js');

test('production does not guess which frontend is the storefront', () => {
  assert.equal(getStorefrontUrl(), null);
});
