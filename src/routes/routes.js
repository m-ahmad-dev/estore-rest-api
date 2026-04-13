import express from "express";
import { apiLimiter } from "../middlewares/rateLimiter.js";
import seedOwner from "../seed.js";
import refreshAccessToken from "../controllers/token.controller.js";
import customerRoutes from "./customer.routes.js";
import adminRoutes from "./admin.routes.js";
import authRoutes from "./auth.routes.js";

const routes = express.Router();

routes.use("/api", apiLimiter);

await seedOwner(); // Ensure owner is seeded before the server starts.

routes.get("/health", (req, res) => res.json({ status: "healthy" }));
routes.post("/api/v1/refresh-token", refreshAccessToken);

routes.use("/api/v1/auth", authRoutes);
routes.use("/api/v1/admin", adminRoutes);
routes.use("/api/v1", customerRoutes);

export default routes;
