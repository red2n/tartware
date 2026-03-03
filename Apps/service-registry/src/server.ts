import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";

import { config } from "./config.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerRegistryRoutes } from "./routes/registry.js";

export const buildServer = (): FastifyInstance => {
  const app = buildFastifyServer({
    logger: appLogger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: true,
    enableMetricsEndpoint: true,
    metricsRegistry,
    beforeRoutes: (app) => {
      app.register(swaggerPlugin);
    },
    registerRoutes: (app) => {
      registerHealthRoutes(app);
      registerRegistryRoutes(app);
    },
  });

  return app;
};
