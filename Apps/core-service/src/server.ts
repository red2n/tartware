import {
  buildFastifyServer,
  createRouteTracker,
  type FastifyInstance,
} from "@tartware/fastify-server";

import { config } from "./config.js";
import { ensureEncryptionRequirementsMet } from "./lib/compliance-policies.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import complianceMonitorPlugin from "./plugins/compliance-monitor.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import swaggerPlugin from "./plugins/swagger.js";
import systemAdminAuthPlugin from "./plugins/system-admin-auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBookingConfigRoutes } from "./routes/booking-config.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerModuleRoutes } from "./routes/modules.js";
import { registerPropertyRoutes } from "./routes/properties.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerReservationRoutes } from "./routes/reservations.js";
import { registerSystemAuthRoutes } from "./routes/system-auth.js";
import { registerSystemImpersonationRoutes } from "./routes/system-impersonation.js";
import { registerSystemTenantRoutes } from "./routes/system-tenants.js";
import { registerSystemUserRoutes } from "./routes/system-users.js";
import { registerTenantRoutes } from "./routes/tenants.js";
import { registerUserTenantAssociationRoutes } from "./routes/user-tenant-associations.js";
import { registerUserRoutes } from "./routes/users.js";

export const buildServer = (): FastifyInstance => {
  ensureEncryptionRequirementsMet();

  const app = buildFastifyServer({
    logger: appLogger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: true,
    enableMetricsEndpoint: true,
    metricsRegistry,
    requestLoggingOptions: {
      includeRequestHeaders: false,
      includeResponseHeaders: false,
      maxDepth: 5,
      sensitiveKeys: [
        "primaryEmail",
        "guestEmail",
        "emailAddress",
        "passportNumber",
        "paymentToken",
        "cardNumber",
        "card_number",
        "routingNumber",
        "accountNumber",
      ],
    },
    beforeRoutes: (app) => {
      app.register(swaggerPlugin);
      app.register(errorHandlerPlugin);
      app.register(authContextPlugin);
      app.register(systemAdminAuthPlugin);
      app.register(complianceMonitorPlugin);
    },
    registerRoutes: (app) => {
      registerHealthRoutes(app);
      registerAuthRoutes(app);
      registerTenantRoutes(app);
      registerPropertyRoutes(app);
      registerUserRoutes(app);
      registerUserTenantAssociationRoutes(app);
      registerDashboardRoutes(app);
      registerReservationRoutes(app);
      registerReportRoutes(app);
      registerModuleRoutes(app);
      registerBookingConfigRoutes(app);
      registerSystemAuthRoutes(app);
      registerSystemTenantRoutes(app);
      registerSystemUserRoutes(app);
      registerSystemImpersonationRoutes(app);
    },
  });

  // Track and log registered routes
  const routeTracker = createRouteTracker(app);
  app.addHook("onReady", async () => {
    routeTracker.logRoutes();
  });

  return app;
};
