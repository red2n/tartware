import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import { withRequestLogging } from "@tartware/telemetry";
import fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";

import { config } from "./config.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerCommandRoutes } from "./routes/commands.js";
import { registerHealthRoutes } from "./routes/health.js";

export const buildServer = (): FastifyInstance => {
  const app = fastify({
    logger: appLogger as FastifyBaseLogger,
    disableRequestLogging: !config.log.requestLogging,
  });

  if (config.log.requestLogging) {
    withRequestLogging(app, {
      includeQuery: true,
      includeParams: true,
    });
  }

  app.register(fastifySensible);
  app.register(fastifyHelmet, { global: true });
  app.register(fastifyCors, { origin: false });
  app.register(authContextPlugin);
  app.register(swaggerPlugin);

  app.get("/metrics", async (_request, reply) => {
    const body = await metricsRegistry.metrics();
    reply.header("Content-Type", metricsRegistry.contentType).send(body);
  });

  app.after(() => {
    registerHealthRoutes(app);
    registerCommandRoutes(app);
  });

  return app;
};
