import test from 'node:test';
import assert from 'node:assert/strict';

import { extractAccessToken } from '../src/core/utils/accessToken.utils.js';

test('reads Bearer token from Authorization header', () => {
  const req = { headers: { authorization: 'Bearer abc.def.ghi' }, cookies: {} };
  assert.equal(extractAccessToken(req), 'abc.def.ghi');
});

test('Authorization header wins over the accessToken cookie', () => {
  const req = {
    headers: { authorization: 'bearer header-token' },
    cookies: { accessToken: 'cookie-token' },
  };
  assert.equal(extractAccessToken(req), 'header-token');
});

test('falls back to the accessToken cookie', () => {
  const req = { headers: {}, cookies: { accessToken: 'cookie-token' } };
  assert.equal(extractAccessToken(req), 'cookie-token');
});

test('returns null when no token is present or header is malformed', () => {
  assert.equal(extractAccessToken({ headers: {}, cookies: {} }), null);
  assert.equal(extractAccessToken({ headers: { authorization: 'Basic xyz' } }), null);
  assert.equal(extractAccessToken({ headers: { authorization: 'Bearer' } }), null);
});
