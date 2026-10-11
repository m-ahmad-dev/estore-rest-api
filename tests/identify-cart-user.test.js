import test from 'node:test';
import assert from 'node:assert/strict';
import identifyCartUser from '../src/core/middlewares/identify_user.middleware.js';

const identify = (user, guestId = 'guest-session') => {
  const req = {
    user,
    cookies: { guest_id: guestId },
  };
  const res = { cookie() {} };
  let nextCalled = false;

  identifyCartUser(req, res, () => {
    nextCalled = true;
  });

  return { cartUser: req.cartUser, nextCalled };
};

test('uses the authenticated customer id for cart ownership', () => {
  const { cartUser, nextCalled } = identify({
    id: 'customer-id',
    role: 'customer',
  });

  assert.deepEqual(cartUser, {
    customer_id: 'customer-id',
    session_id: null,
  });
  assert.equal(nextCalled, true);
});

test('uses the guest session for non-customer authenticated users', () => {
  const { cartUser, nextCalled } = identify({
    id: 'admin-id',
    role: 'admin',
  });

  assert.deepEqual(cartUser, {
    customer_id: null,
    session_id: 'guest-session',
  });
  assert.equal(nextCalled, true);
});
