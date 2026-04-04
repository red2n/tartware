import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";

import { config } from "./config.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerBuildingRoutes } from "./routes/buildings.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerRateCalendarRoutes } from "./routes/rate-calendar.js";
import { registerRateRoutes } from "./routes/rates.js";
import { registerRecommendationRoutes } from "./routes/recommendations.js";
import { registerRoomTypeRoutes } from "./routes/room-types.js";
import { registerRoomRoutes } from "./routes/rooms.js";
import { initializePipeline } from "./services/index.js";

export const buildServer = (): FastifyInstance => {
  initializePipeline();

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
      registerRoomRoutes(app);
      registerRoomTypeRoutes(app);
      registerBuildingRoutes(app);
      registerRateRoutes(app);
      registerRateCalendarRoutes(app);
      registerRecommendationRoutes(app);
    },
  });

  return app;
};
