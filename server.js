import app from "./src/app.js";
import env from "./src/configs/env.js";
import startCleanupJob from "./src/jobs/cleanup.jobs.js";

const PORT = env.PORT;

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    environment: env.NODE_ENV || "development",
  });
});

startCleanupJob();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
