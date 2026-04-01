import {
  buildFastifyServer,
  createRouteTracker,
  type FastifyInstance,
} from "@tartware/fastify-server";

import { config } from "./config.js";
import { ensureEncryptionRequirementsMet } from "./lib/compliance-policies.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import { authPlugin as settingsAuthPlugin } from "./modules/settings-service/plugins/auth.js";
import settingsAmenitiesRoutes from "./modules/settings-service/routes/amenities.js";
import settingsCatalogRoutes from "./modules/settings-service/routes/catalog.js";
import settingsPackagesRoutes from "./modules/settings-service/routes/packages.js";
import settingsScreenPermissionsRoutes from "./modules/settings-service/routes/screen-permissions.js";
import authContextPlugin from "./plugins/auth-context.js";
import complianceMonitorPlugin from "./plugins/compliance-monitor.js";
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
import { registerReportRoutes } from "./routes/reports.js";
import { registerReservationRoutes } from "./routes/reservations.js";
import { registerServiceStatusRoutes } from "./routes/service-status.js";
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

      // Host settings-service routes in core-service to reduce physical service count
      // without changing the underlying settings route/repository logic.
      app.register(async (settingsApp) => {
        await settingsApp.register(settingsAuthPlugin);

        await settingsApp.register(async (secureSettingsRoutes) => {
          secureSettingsRoutes.addHook("onRequest", secureSettingsRoutes.authenticate);

          await secureSettingsRoutes.register(settingsCatalogRoutes);
          await secureSettingsRoutes.register(settingsAmenitiesRoutes);
          await secureSettingsRoutes.register(settingsPackagesRoutes);
          await secureSettingsRoutes.register(settingsScreenPermissionsRoutes);

          secureSettingsRoutes.get("/v1/settings/health", async () => ({
            status: "ok",
            scope: "protected",
          }));
        });
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
