import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";

import { config } from "./config.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerAllowanceRoutes } from "./routes/allowance.js";
import { registerAuthorizationRoutes } from "./routes/authorization.js";
import { registerCancellationRoutes } from "./routes/cancellation.js";
import { registerCommissionRoutes } from "./routes/commission.js";
import { registerCompRoutes } from "./routes/comp.js";
import { registerDepositRoutes } from "./routes/deposit.js";
import { registerFolioRoutes } from "./routes/folio.js";
import { registerForexRoutes } from "./routes/forex.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLoyaltyRoutes } from "./routes/loyalty.js";
import { registerProrationRoutes } from "./routes/proration.js";
import { registerRateRoutes } from "./routes/rate.js";
import { registerRevenueRoutes } from "./routes/revenue.js";
import { registerRevenueForecastRoutes } from "./routes/revenue-forecast.js";
import { registerSplitRoutes } from "./routes/split.js";
import { registerTaxRoutes } from "./routes/tax.js";
import { registerYieldRoutes } from "./routes/yield.js";

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
      registerTaxRoutes(app);
      registerRateRoutes(app);
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
