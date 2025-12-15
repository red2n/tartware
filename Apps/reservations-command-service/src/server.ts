import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import fastify, { type FastifyBaseLogger } from "fastify";

import { serviceConfig } from "./config.js";
import { checkDatabaseHealth, checkKafkaHealth } from "./lib/health-checks.js";
import { metricsRegistry } from "./lib/metrics.js";
import { reservationsLogger } from "./logger.js";
import { registerReservationCommandRoutes } from "./routes/reservation-commands.js";

export const buildServer = () => {
  const app = fastify({
    logger: reservationsLogger as FastifyBaseLogger,
  });

  app.register(fastifyHelmet, { global: true });
  app.register(fastifySensible);

  app.get("/health", async () => ({
    status: "ok",
    service: serviceConfig.serviceId,
  }));

  app.get("/health/liveness", async () => ({
    status: "alive",
    service: serviceConfig.serviceId,
  }));

  app.get("/health/readiness", async (_request, reply) => {
    try {
      await Promise.all([checkDatabaseHealth(), checkKafkaHealth()]);
      return {
        status: "ready",
        service: serviceConfig.serviceId,
      };
    } catch (error) {
      app.log.error(error, "Readiness check failed");
      void reply.code(503);
      return {
        status: "unavailable",
        service: serviceConfig.serviceId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  app.get("/metrics", async (_request, reply) => {
    void reply.header("Content-Type", metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });

  registerReservationCommandRoutes(app);

  return app;
};
