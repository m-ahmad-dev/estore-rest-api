/**
 * Fire-and-forget task runner to truly isolate background processes
 * from the main HTTP response thread.
 */
export const fireBackgroundTask = (workerFunction) => {
  // We use process.nextTick or setTimeout with 0ms to push execution
  // out of the current synchronous call stack completely.
  setTimeout(() => {
    workerFunction().catch((err) => {
      console.error(
        '[BACKGROUND WORKER CRITICAL ERROR]:',
        err.message
      );
    });
  }, 0);
};
