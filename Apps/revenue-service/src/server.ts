import {
  buildFastifyServer,
  createHealthRoutes,
  type FastifyInstance,
} from "@tartware/fastify-server";
import type { PinoLogger } from "@tartware/telemetry";

import { config } from "./config.js";
import { query } from "./lib/db.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth.js";
import swaggerPlugin from "./plugins/swagger.js";
import pricingRoutes from "./routes/pricing.js";
import reportRoutes from "./routes/reports.js";

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

  void app.register(authContextPlugin);
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
    await secureRoutes.register(pricingRoutes);
    await secureRoutes.register(reportRoutes);

    secureRoutes.get("/v1/revenue/ping", async () => ({
      status: "ok",
      scope: "protected",
    }));
  });

  return app;
};
