import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";

import { config } from "./config.js";
import { ensureGuestEncryptionRequirementsMet } from "./lib/compliance.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import { registerSelfServiceRoutes } from "./modules/guest-experience-service/routes/self-service.js";
import sseTokenPlugin from "./modules/notification-service/plugins/sse-token.js";
import { registerInAppNotificationRoutes } from "./modules/notification-service/routes/in-app-notifications.js";
import { registerNotificationRoutes } from "./modules/notification-service/routes/notifications.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerGuestRoutes } from "./routes/guests.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLoyaltyRoutes } from "./routes/loyalty.js";
import { registerPrivacyRoutes } from "./routes/privacy.js";

export const buildServer = (): FastifyInstance => {
  ensureGuestEncryptionRequirementsMet();

  const app = buildFastifyServer({
    logger: appLogger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: true,
    metricsRegistry,
    beforeRoutes: (app) => {
      app.register(sseTokenPlugin);
      app.register(authContextPlugin);
      app.register(swaggerPlugin);
    },
    registerRoutes: (app) => {
      registerHealthRoutes(app);
      registerGuestRoutes(app);
      registerLoyaltyRoutes(app);
      registerPrivacyRoutes(app);
      registerSelfServiceRoutes(app);
      registerNotificationRoutes(app);
      registerInAppNotificationRoutes(app);
    },
  });

  return app;
};
