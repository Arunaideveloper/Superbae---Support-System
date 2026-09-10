import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { attachUser } from "./middleware/auth.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { notFound, errorHandler } from "./middleware/error.js";

import authRouter from "./modules/auth/router.js";
import usersRouter from "./modules/users/router.js";
import ticketsRouter from "./modules/tickets/router.js";
import teamsRouter from "./modules/teams/router.js";
import { kbAdminRouter, kbPublicRouter } from "./modules/kb/router.js";
import publicTicketsRouter from "./modules/tickets/publicRouter.js";
import assistantRouter from "./modules/assistant/router.js";
import aiRouter from "./modules/ai/router.js";

export function createApp() {
  const app = express();

  // Behind a proxy (Nginx, a PaaS) so rate-limit sees the real client IP.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",") }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", apiLimiter);

  // Attach req.user (if a valid Bearer token is present) for every route.
  app.use(attachUser);

  app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "superbae-server" }));

  // Auth (register/login/refresh/me)
  app.use("/api", authRouter);

  // Admin & authenticated domains
  app.use("/api/users", usersRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/teams", teamsRouter);
  app.use("/api/kb", kbAdminRouter);
  app.use("/api/assistant", assistantRouter);
  app.use("/api/ai", aiRouter);

  // Public (no auth)
  app.use("/api/public/kb", kbPublicRouter);
  app.use("/api/public/tickets", publicTicketsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
