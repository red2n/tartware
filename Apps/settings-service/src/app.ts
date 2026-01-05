import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";
import type { PinoLogger } from "@tartware/telemetry";

import { config } from "./config.js";
import { authPlugin } from "./plugins/auth.js";
import swaggerPlugin from "./plugins/swagger.js";
import amenitiesRoutes from "./routes/amenities.js";
import catalogRoutes from "./routes/catalog.js";

type BuildServerOptions = {
  logger: PinoLogger;
};

export const buildServer = ({ logger }: BuildServerOptions): FastifyInstance => {
  const app = buildFastifyServer({
    logger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: false, // No metrics endpoint for this service
  });

  void app.register(authPlugin);
  void app.register(swaggerPlugin);

  app.get("/health", async () => ({
    status: "ok",
    service: config.service.name,
    version: config.service.version,
    uptime: process.uptime(),
  }));

  app.get("/ready", async () => ({ status: "ready" }));

  app.register(async (secureRoutes) => {
    secureRoutes.addHook("onRequest", secureRoutes.authenticate);

    await secureRoutes.register(catalogRoutes);
    await secureRoutes.register(amenitiesRoutes);

    secureRoutes.get("/v1/settings/ping", async () => ({
      status: "ok",
      scope: "protected",
    }));
  });

  return app;
};
