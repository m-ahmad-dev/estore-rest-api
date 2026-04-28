import express from "express";
import { apiLimiter } from "../core/middlewares/rateLimiter.js";
import seedOwner from "../core/seeds/owner.seed.js";
import refreshAccessToken from "../modules/token/token.controller.js";
import authRoutes from "../modules/auth/auth.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import customerRoutes from "../modules/customer/customer.routes.js";
import addressRoutes from "./address/address.routes.js";

const routes = express.Router();

routes.use("/api", apiLimiter);

await seedOwner(); // Ensure owner is seeded before the server starts.

routes.get("/health", (req, res) => res.json({ status: "healthy" }));
routes.post("/api/v1/refresh-token", refreshAccessToken);

routes.use("/api/v1/auth", authRoutes);
routes.use("/api/v1/admin/admins", adminRoutes);
routes.use("/api/v1", customerRoutes);
routes.use("/api/v1", addressRoutes);

export default routes;
