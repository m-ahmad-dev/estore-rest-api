import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'development';
process.env.COOKIE_SAME_SITE = 'none';

const { accessCookieConfig, refreshCookieConfig } = await import(
  '../src/core/utils/cookies.utils.js'
);

test('SameSite=None forces Secure even outside production', () => {
  assert.equal(accessCookieConfig.sameSite, 'None');
  assert.equal(accessCookieConfig.secure, true);
  assert.equal(refreshCookieConfig.httpOnly, true);
  assert.equal(refreshCookieConfig.path, '/api/v1/refresh-token');
});
