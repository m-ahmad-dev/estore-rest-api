import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import errorMiddleware from "./middlewares/error.middleware.js";
import env from "./configs/env.js";
import routes from "./routes/routes.js";
import passport from "passport";

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Passport initialize
app.use(passport.initialize());
// Load Passport Config (Strategy registration)
import "./configs/passport.js";

if (env.NODE_ENV === "production") {
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
}

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

app.disable("x-powered-by");

app.use(routes);

app.use(errorMiddleware);

export default app;
