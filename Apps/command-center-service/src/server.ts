import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";

import { config } from "./config.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerCommandDefinitionRoutes } from "./routes/command-definitions.js";
import { registerCommandRoutes } from "./routes/commands.js";
import { registerHealthRoutes } from "./routes/health.js";

export const buildServer = (): FastifyInstance => {
  const app = buildFastifyServer({
    logger: appLogger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: true,
    metricsRegistry,
    beforeRoutes: (app) => {
      app.register(authContextPlugin);
      app.register(swaggerPlugin);
    },
    registerRoutes: (app) => {
      registerHealthRoutes(app);
      registerCommandDefinitionRoutes(app);
      registerCommandRoutes(app);
    },
  });

  return app;
};
