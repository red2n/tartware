import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";

import { config } from "./config.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerDeepCleanRoutes } from "./routes/deep-clean.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerHousekeepingRoutes } from "./routes/housekeeping.js";
import { registerIncidentRoutes } from "./routes/incidents.js";
import { registerInspectionRoutes } from "./routes/inspections.js";
import { registerMaintenanceRoutes } from "./routes/maintenance.js";
import { registerScheduleRoutes } from "./routes/schedules.js";

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
      registerHousekeepingRoutes(app);
      registerDeepCleanRoutes(app);
      registerScheduleRoutes(app);
      registerInspectionRoutes(app);
      registerMaintenanceRoutes(app);
      registerIncidentRoutes(app);
    },
  });

  return app;
};
