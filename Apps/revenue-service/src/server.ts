import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";
import type { PinoLogger } from "@tartware/telemetry";

import { config } from "./config.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth.js";
import swaggerPlugin from "./plugins/swagger.js";
import pricingRoutes from "./routes/pricing.js";
import reportRoutes from "./routes/reports.js";

type BuildServerOptions = {
  logger: PinoLogger;
};

export const buildServer = ({ logger }: BuildServerOptions): FastifyInstance => {
  const app = buildFastifyServer({
    logger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: true,
    metricsRegistry,
  });

  void app.register(authContextPlugin);
  void app.register(swaggerPlugin);

  app.get("/health", async () => ({
    status: "ok",
    service: config.service.name,
    version: config.service.version,
    uptime: process.uptime(),
  }));

  app.get("/ready", async () => ({ status: "ready" }));

  app.register(async (secureRoutes) => {
    await secureRoutes.register(pricingRoutes);
    await secureRoutes.register(reportRoutes);

    secureRoutes.get("/v1/revenue/ping", async () => ({
      status: "ok",
      scope: "protected",
    }));
  });

  return app;
};
