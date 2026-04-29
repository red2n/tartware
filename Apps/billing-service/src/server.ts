import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";

import { config } from "./config.js";
import { ensureBillingEncryptionRequirementsMet } from "./lib/compliance-policies.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import rollBackfillJobPlugin from "./plugins/roll-backfill-job.js";
import rollDateRollSchedulerPlugin from "./plugins/roll-date-roll-scheduler.js";
import rollLifecycleConsumerPlugin from "./plugins/roll-lifecycle-consumer.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerAccountsRoutes } from "./routes/accounts.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerAllowanceRoutes } from "./routes/calculations/allowance.js";
import { registerAuthorizationRoutes } from "./routes/calculations/authorization.js";
import { registerCancellationRoutes } from "./routes/calculations/cancellation.js";
import { registerCommissionRoutes } from "./routes/calculations/commission.js";
import { registerCompRoutes } from "./routes/calculations/comp.js";
import { registerDepositRoutes } from "./routes/calculations/deposit.js";
import { registerFolioRoutes } from "./routes/calculations/folio.js";
import { registerForexRoutes } from "./routes/calculations/forex.js";
import { registerLoyaltyRoutes } from "./routes/calculations/loyalty.js";
import { registerProrationRoutes } from "./routes/calculations/proration.js";
import { registerRateRoutes } from "./routes/calculations/rate.js";
import { registerRevenueRoutes } from "./routes/calculations/revenue.js";
import { registerRevenueForecastRoutes } from "./routes/calculations/revenue-forecast.js";
import { registerSplitRoutes } from "./routes/calculations/split.js";
import { registerTaxRoutes } from "./routes/calculations/tax.js";
import { registerYieldRoutes } from "./routes/calculations/yield.js";
import { registerFinanceAdminRoutes } from "./routes/finance-admin.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerNightAuditRoutes } from "./routes/night-audit.js";
import { registerPosChargeRoutes } from "./routes/pos.js";

export const buildServer = (): FastifyInstance => {
  ensureBillingEncryptionRequirementsMet();

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
      registerBillingRoutes(app);
      // Absorbed from accounts-service (Phase 6)
      registerAccountsRoutes(app);
      // Absorbed from finance-admin-service (Phase 6)
      registerFinanceAdminRoutes(app);
      // Night audit read endpoints
      registerNightAuditRoutes(app);
      // HTNG POS charge endpoint (ACCT-05)
      registerPosChargeRoutes(app);
      // Absorbed from calculation-service (Phase 6)
      registerAllowanceRoutes(app);
      registerAuthorizationRoutes(app);
      registerCancellationRoutes(app);
      registerCommissionRoutes(app);
      registerCompRoutes(app);
      registerDepositRoutes(app);
      registerFolioRoutes(app);
      registerForexRoutes(app);
      registerLoyaltyRoutes(app);
      registerProrationRoutes(app);
      registerRateRoutes(app);
      registerRevenueForecastRoutes(app);
      registerRevenueRoutes(app);
      registerSplitRoutes(app);
      registerTaxRoutes(app);
      registerYieldRoutes(app);
    },
  });

  // Absorbed from roll-service (Phase 6) — Kafka consumer + backfill + date-roll scheduler
  void app.register(rollLifecycleConsumerPlugin);
  void app.register(rollBackfillJobPlugin);
  void app.register(rollDateRollSchedulerPlugin);

  return app;
};
