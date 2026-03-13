import {
  buildFastifyServer,
  createHealthRoutes,
  type FastifyInstance,
} from "@tartware/fastify-server";
import type { PinoLogger } from "@tartware/telemetry";

import { config } from "./config.js";
import { query } from "./lib/db.js";
import { metricsRegistry } from "./lib/metrics.js";
import { authPlugin } from "./plugins/auth.js";
import swaggerPlugin from "./plugins/swagger.js";
import amenitiesRoutes from "./routes/amenities.js";
import catalogRoutes from "./routes/catalog.js";
import packagesRoutes from "./routes/packages.js";
import screenPermissionsRoutes from "./routes/screen-permissions.js";

type BuildServerOptions = {
  logger: PinoLogger;
};

export const buildServer = ({ logger }: BuildServerOptions): FastifyInstance => {
  const app = buildFastifyServer({
    logger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: true,
    metricsRegistry,
  });

  void app.register(authPlugin);
  void app.register(swaggerPlugin);

  const registerHealthRoutes = createHealthRoutes({
    serviceName: config.service.name,
    serviceVersion: config.service.version,
    dependencies: [
      {
        name: "database",
        check: async () => {
          await query("SELECT 1");
        },
      },
    ],
  });
  registerHealthRoutes(app);

  app.register(async (secureRoutes) => {
    secureRoutes.addHook("onRequest", secureRoutes.authenticate);

    await secureRoutes.register(catalogRoutes);
    await secureRoutes.register(amenitiesRoutes);
    await secureRoutes.register(packagesRoutes);
    await secureRoutes.register(screenPermissionsRoutes);

    secureRoutes.get("/v1/settings/ping", async () => ({
      status: "ok",
      scope: "protected",
    }));
  });

  return app;
};
