import { getBaseCookieConfig } from '../utils/cookies.utils.js';

const GUEST_COOKIE_NAME = 'guest_id';
const GUEST_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const generateGuestId = () => crypto.randomUUID();

const identifyCartUser = (req, res, next) => {
  if (req.user) {
    req.cartUser = {
      customer_id: req.user.id,
      session_id: null,
    };
    return next();
  }

  // Fallback: Handle Guest User
  let guestId = req.cookies[GUEST_COOKIE_NAME];

  if (!guestId) {
    guestId = generateGuestId();

    res.cookie(
      GUEST_COOKIE_NAME,
      guestId,
      getBaseCookieConfig({ maxAge: GUEST_COOKIE_MAX_AGE })
    );
  }

  req.cartUser = {
    customer_id: null,
    session_id: guestId,
  };

  next();
};

export default identifyCartUser;
