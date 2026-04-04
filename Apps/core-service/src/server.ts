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
import { settingsAuthPlugin } from "./plugins/settings-auth.js";
import swaggerPlugin from "./plugins/swagger.js";
import systemAdminAuthPlugin from "./plugins/system-admin-auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBookingConfigRoutes } from "./routes/booking-config.js";
import { registerComplianceRoutes } from "./routes/compliance.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerDirectBookingRoutes } from "./routes/direct-booking.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerModuleRoutes } from "./routes/modules.js";
import { registerNightAuditRoutes, registerOtaRoutes } from "./routes/night-audit.js";
import {
  registerBanquetOrderRoutes,
  registerCashierSessionRoutes,
  registerGuestFeedbackRoutes,
  registerLostFoundRoutes,
  registerPoliceReportRoutes,
  registerShiftHandoverRoutes,
} from "./routes/operations.js";
import { registerPropertyRoutes } from "./routes/properties.js";
import { registerRegistryRoutes } from "./routes/registry.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerReservationRoutes } from "./routes/reservations.js";
import { registerServiceStatusRoutes } from "./routes/service-status.js";
import amenitiesRoutes from "./routes/settings-amenities.js";
import catalogRoutes from "./routes/settings-catalog.js";
import packagesRoutes from "./routes/settings-packages.js";
import screenPermissionsRoutes from "./routes/settings-screen-permissions.js";
import { registerSystemAuthRoutes } from "./routes/system-auth.js";
import { registerSystemImpersonationRoutes } from "./routes/system-impersonation.js";
import { registerSystemTenantRoutes } from "./routes/system-tenants.js";
import { registerSystemUserRoutes } from "./routes/system-users.js";
import { registerTenantRoutes } from "./routes/tenants.js";
import { registerUiPreferencesRoutes } from "./routes/ui-preferences.js";
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
      app.register(authContextPlugin);
      app.register(systemAdminAuthPlugin);
      app.register(complianceMonitorPlugin);
      app.register(settingsAuthPlugin);
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
      registerComplianceRoutes(app);
      registerNightAuditRoutes(app);
      registerOtaRoutes(app);
      registerCashierSessionRoutes(app);
      registerShiftHandoverRoutes(app);
      registerLostFoundRoutes(app);
      registerBanquetOrderRoutes(app);
      registerGuestFeedbackRoutes(app);
      registerPoliceReportRoutes(app);
      registerSystemAuthRoutes(app);
      registerSystemTenantRoutes(app);
      registerSystemUserRoutes(app);
      registerSystemImpersonationRoutes(app);
      registerDirectBookingRoutes(app);
      registerUiPreferencesRoutes(app);
      registerServiceStatusRoutes(app);

      // ─── Absorbed from service-registry ───────────────────────────────
      registerRegistryRoutes(app);

      // ─── Absorbed from settings-service ───────────────────────────────
      void app.register(async (settingsScope) => {
        settingsScope.addHook("onRequest", settingsScope.settingsAuthenticate);
        await settingsScope.register(catalogRoutes);
        await settingsScope.register(amenitiesRoutes);
        await settingsScope.register(packagesRoutes);
        await settingsScope.register(screenPermissionsRoutes);
      });
    },
  });

  // Track and log registered routes
  const routeTracker = createRouteTracker(app);
  app.addHook("onReady", async () => {
    routeTracker.logRoutes();
  });

  return app;
};
