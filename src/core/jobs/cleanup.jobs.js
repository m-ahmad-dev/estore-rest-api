import cron from 'node-cron';
import prisma from '../configs/db.js';
import env from '../configs/env.js';

/* Constants */

const CART_ABANDONMENT_DAYS = 40; // Mark carts as abandoned after 40 days of inactivity
const CART_DELETION_DAYS = 90; // Permanently delete abandoned carts after 90 days

/* Handling expired auth tokens */

const cleanupAuthTokens = async (now) => {
  const [passwordResetResult, refreshTokensResult] =
    await Promise.all([
      prisma.passwordReset.deleteMany({
        where: {
          OR: [{ expires_at: { lt: now } }, { used: true }],
        },
      }),
      prisma.refresh_tokens.deleteMany({
        where: { expires_at: { lt: now } },
      }),
    ]);

  return {
    passwordReset: passwordResetResult.count,
    refreshTokens: refreshTokensResult.count,
  };
};

/* Handling expired guest carts */

const cleanupExpiredGuestCarts = async (now) => {
  const result = await prisma.carts.deleteMany({
    where: {
      customer_id: null,
      expires_at: { lt: now },
    },
  });
  return result.count;
};

const markAbandonedCustomerCarts = async (now) => {
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - CART_ABANDONMENT_DAYS);

  const result = await prisma.carts.updateMany({
    where: {
      customer_id: { not: null },
      status: 'ACTIVE',
      updated_at: { lt: threshold },
    },
    data: { status: 'ABANDONED' },
  });

  return result.count;
};

const cleanupAbandonedCustomerCarts = async (now) => {
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - CART_DELETION_DAYS);

  const result = await prisma.carts.deleteMany({
    where: {
      customer_id: { not: null },
      status: 'ABANDONED',
      updated_at: { lt: threshold },
    },
  });

  return result.count;
};

const cleanupCarts = async (now) => {
  const [marked, guestDeleted, abandonedDeleted] = await Promise.all([
    markAbandonedCustomerCarts(now),
    cleanupExpiredGuestCarts(now),
    cleanupAbandonedCustomerCarts(now),
  ]);

  return { marked, guestDeleted, abandonedDeleted };
};

// Initialize the cleanup cron job //
const startCleanupJob = () => {
  cron.schedule(env.CLEANUP_SCHEDULE, async () => {
    const now = new Date();

    const [authResult, cartResult] = await Promise.allSettled([
      cleanupAuthTokens(now),
      cleanupCarts(now),
    ]);

    // Auth tokens
    if (authResult.status === 'fulfilled') {
      const { passwordReset, refreshTokens } = authResult.value;
      console.log(
        `[CRON] Auth — passwordReset:${passwordReset}, refreshTokens:${refreshTokens}`
      );
    } else {
      console.error('[CRON] Auth cleanup failed:', authResult.reason);
    }

    // Carts
    if (cartResult.status === 'fulfilled') {
      const { marked, guestDeleted, abandonedDeleted } =
        cartResult.value;
      console.log(
        `[CRON] Carts — marked:${marked}, 
        guestDeleted:${guestDeleted}, 
        abandonedDeleted:${abandonedDeleted}`
      );
    } else {
      console.error('[CRON] Cart cleanup failed:', cartResult.reason);
    }
  });
};

export default startCleanupJob;
