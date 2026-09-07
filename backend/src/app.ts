import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { attachUser } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/error.js";

import authRouter from "./modules/auth/router.js";
import usersRouter from "./modules/users/router.js";
import ticketsRouter from "./modules/tickets/router.js";
import { kbAdminRouter, kbPublicRouter } from "./modules/kb/router.js";
import assistantRouter from "./modules/assistant/router.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",") }));
  app.use(express.json({ limit: "2mb" }));

  // Attach req.user (if a valid Bearer token is present) for every route.
  app.use(attachUser);

  app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "superbae-server" }));

  // Auth (register/login/refresh/me)
  app.use("/api", authRouter);

  // Admin & authenticated domains
  app.use("/api/users", usersRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/kb", kbAdminRouter);
  app.use("/api/assistant", assistantRouter);

  // Public (no auth)
  app.use("/api/public/kb", kbPublicRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
