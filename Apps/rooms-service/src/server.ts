import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";

import { config } from "./config.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import { registerAllowanceRoutes } from "./modules/calculation-service/routes/allowance.js";
import { registerAuthorizationRoutes } from "./modules/calculation-service/routes/authorization.js";
import { registerCancellationRoutes } from "./modules/calculation-service/routes/cancellation.js";
import { registerCommissionRoutes } from "./modules/calculation-service/routes/commission.js";
import { registerCompRoutes } from "./modules/calculation-service/routes/comp.js";
import { registerDepositRoutes } from "./modules/calculation-service/routes/deposit.js";
import { registerFolioRoutes } from "./modules/calculation-service/routes/folio.js";
import { registerForexRoutes } from "./modules/calculation-service/routes/forex.js";
import { registerLoyaltyRoutes } from "./modules/calculation-service/routes/loyalty.js";
import { registerProrationRoutes } from "./modules/calculation-service/routes/proration.js";
import { registerRateRoutes as registerCalculationRateRoutes } from "./modules/calculation-service/routes/rate.js";
import { registerRevenueRoutes } from "./modules/calculation-service/routes/revenue.js";
import { registerRevenueForecastRoutes } from "./modules/calculation-service/routes/revenue-forecast.js";
import { registerSplitRoutes } from "./modules/calculation-service/routes/split.js";
import { registerTaxRoutes } from "./modules/calculation-service/routes/tax.js";
import { registerYieldRoutes } from "./modules/calculation-service/routes/yield.js";
import { registerRecommendationRoutes } from "./modules/recommendation-service/routes/recommendations.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerBuildingRoutes } from "./routes/buildings.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerRateCalendarRoutes } from "./routes/rate-calendar.js";
import { registerRateRoutes as registerRoomsRateRoutes } from "./routes/rates.js";
import { registerRoomTypeRoutes } from "./routes/room-types.js";
import { registerRoomRoutes } from "./routes/rooms.js";

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
      registerRoomRoutes(app);
      registerRoomTypeRoutes(app);
      registerBuildingRoutes(app);
      registerRoomsRateRoutes(app);
      registerRateCalendarRoutes(app);

      // Host recommendation and calculation service routes in rooms-service
      // to reduce physical service count without changing route logic.
      registerRecommendationRoutes(app);
      registerTaxRoutes(app);
      registerCalculationRateRoutes(app);
      registerFolioRoutes(app);
      registerRevenueRoutes(app);
      registerSplitRoutes(app);
      registerDepositRoutes(app);
      registerCommissionRoutes(app);
      registerAuthorizationRoutes(app);
      registerCancellationRoutes(app);
      registerYieldRoutes(app);
      registerForexRoutes(app);
      registerProrationRoutes(app);
      registerAllowanceRoutes(app);
      registerCompRoutes(app);
      registerLoyaltyRoutes(app);
      registerRevenueForecastRoutes(app);
    },
  });

  return app;
};
