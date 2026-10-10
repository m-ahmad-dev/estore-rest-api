import app from './src/app.js';
import env from './src/core/configs/env.js';
import startCleanupJob from './src/core/jobs/cleanup.jobs.js';
import startShipmentRetryJob from './src/core/jobs/retry-shipment.jobs.js';
import prisma from './src/core/configs/db.js';

const PORT = env.PORT || 3000;

/**
 * Starts the cleanup job and initializes the Express server.
 */
const startServer = async () => {
  try {
    // Initialize background jobs
    startCleanupJob();
    startShipmentRetryJob();

    const server = app.listen(PORT, () => {
      console.info(`Server running on http://localhost:${PORT}`);
      console.info(`Environment: ${env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.info(`\n${signal} received. Shutting down gracefully...`);
      server.close(async (closeError) => {
        if (closeError) console.error('HTTP server close failed:', closeError);
        try {
          await prisma.$disconnect();
        } catch (disconnectError) {
          console.error('Database disconnect failed:', disconnectError);
        }
        console.info('Server and database connections closed.');
        process.exit(closeError ? 1 : 0);
      });
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
