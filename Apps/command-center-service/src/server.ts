import {
  buildFastifyServer,
  type FastifyInstance,
  resolveServiceRegistryConfig,
} from "@tartware/fastify-server";
import { SERVICE_REGISTRY_CATALOG } from "@tartware/schemas";

import { config } from "./config.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import { registerRollModule } from "./modules/roll-service/register.js";
import { registerRegistryRoutes } from "./modules/service-registry/routes/registry.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerCommandDefinitionRoutes } from "./routes/command-definitions.js";
import { registerCommandFeatureRoutes } from "./routes/command-features.js";
import { registerCommandRoutes } from "./routes/commands.js";
import { registerHealthRoutes } from "./routes/health.js";

export const buildServer = (): FastifyInstance => {
  const registryMetadata = SERVICE_REGISTRY_CATALOG["command-center-service"];
  const app = buildFastifyServer({
    logger: appLogger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: true,
    metricsRegistry,
    serviceRegistry: resolveServiceRegistryConfig({
      ...registryMetadata,
      serviceVersion: config.service.version,
      host: config.host,
      port: config.port,
    }),
    beforeRoutes: (app) => {
      app.register(authContextPlugin);
      app.register(swaggerPlugin);
    },
    registerRoutes: (app) => {
      registerHealthRoutes(app);
      registerRegistryRoutes(app);
      registerCommandDefinitionRoutes(app);
      registerCommandFeatureRoutes(app);
      registerCommandRoutes(app);
      registerRollModule(app);
    },
  });

  return app;
};
