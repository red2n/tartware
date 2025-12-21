import type { FastifyInstance } from "fastify";

import { config } from "../config.js";

export const registerHealthRoutes = (app: FastifyInstance): void => {
  app.get("/health", async () => ({
    status: "ok",
    service: config.service.name,
    version: config.service.version,
  }));

  app.get("/ready", async () => ({ status: "ready" }));
};
