import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";

import { config } from "./config.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerHealthRoutes, registerRecommendationRoutes } from "./routes/index.js";

export const buildServer = (): FastifyInstance => {
  const app = Fastify({
    loggerInstance: appLogger as FastifyBaseLogger,
    disableRequestLogging: !config.log.requestLogging,
  });

  // Security plugins
  void app.register(helmet, { global: true });
  void app.register(cors, { origin: false });
  void app.register(sensible);

  // Metrics endpoint
  app.get("/metrics", async (_request, reply) => {
    const metrics = await metricsRegistry.metrics();
    void reply.header("content-type", metricsRegistry.contentType);
    return metrics;
  });

  // Auth and Swagger plugins
  void app.register(authContextPlugin);
  void app.register(swaggerPlugin);

  // Register routes
  registerHealthRoutes(app);
  registerRecommendationRoutes(app);

  return app;
};
