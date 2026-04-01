import {
  buildFastifyServer,
  type FastifyInstance,
  resolveServiceRegistryConfig,
} from "@tartware/fastify-server";

import { config } from "./config.js";
import { ensureBillingEncryptionRequirementsMet } from "./lib/compliance-policies.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import { registerCashierRoutes } from "./modules/cashier-service/routes/cashier.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerHealthRoutes } from "./routes/health.js";

export const buildServer = (): FastifyInstance => {
  ensureBillingEncryptionRequirementsMet();

  const app = buildFastifyServer({
    logger: appLogger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: true,
    metricsRegistry,
    serviceRegistry: resolveServiceRegistryConfig({
      serviceName: "billing-service",
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
      registerBillingRoutes(app);
      registerCashierRoutes(app);
    },
  });

  return app;
};
