import cron from "node-cron";
import prisma from "../configs/db.js";
import env from "../configs/env.js";

const startCleanupJob = () => {
  cron.schedule(env.CLEANUP_SCHEDULE, async () => {
    try {
      const now = new Date();

      const [passwordReset, refreshTokens] = await Promise.all([
        prisma.passwordReset.deleteMany({
          where: {
            OR: [{ expires_at: { lt: now } }, { used: true }],
          },
        }),
        prisma.refresh_tokens.deleteMany({
          where: {
            expires_at: { lt: now },
          },
        }),
      ]);

      console.log(
        `[CRON] Cleanup: reset=${passwordReset.count}, refresh=${refreshTokens.count}`,
      );
    } catch (err) {
      console.error("[CRON] Cleanup failed:", err);
    }
  });
};

export default startCleanupJob;
