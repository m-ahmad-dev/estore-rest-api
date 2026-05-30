import express from "express";
import auth from "../../core/middlewares/auth.middleware.js";
import validate from "../../core/middlewares/input_validate.middleware.js";
import { getPresignedUrlSchema } from "./upload.validation.js";
import { getPresignedUrl } from "./upload.controller.js";
import rateLimit from "express-rate-limit";
import authorizePermission from "../../core/middlewares/pbac.middleware.js";

const uploadRoutes = express.Router();
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many upload requests, please try again later.",
});

uploadRoutes.get(
  "/presigned-url",
  auth,
  uploadLimiter,
  validate(getPresignedUrlSchema, "query"),
  authorizePermission("products.create"),
  getPresignedUrl,
);

export default uploadRoutes;
