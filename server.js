import app from './src/app.js';
import env from './src/core/configs/env.js';
import startCleanupJob from './src/core/jobs/cleanup.jobs.js';

const PORT = env.PORT || 3000;

/**
 * Starts the cleanup job and initializes the Express server.
 */
const startServer = async () => {
  try {
    // Initialize background jobs
    startCleanupJob();

    const server = app.listen(PORT, () => {
      console.info(`Server running on http://localhost:${PORT}`);
      console.info(`Environment: ${env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.info(
        `\n${signal} received. Shutting down gracefully...`
      );
      server.close(() => {
        console.info('Server closed. Exiting process.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
