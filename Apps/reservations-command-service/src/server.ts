import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import fastify, { type FastifyBaseLogger } from "fastify";

import { serviceConfig } from "./config.js";
import {
  checkDatabaseHealth,
  checkKafkaHealth,
  checkLifecycleGuardHealth,
} from "./lib/health-checks.js";
import type { LifecycleHealthSummary } from "./lib/lifecycle-guard.js";
import { getLifecycleHealthSummary } from "./lib/lifecycle-guard.js";
import { metricsRegistry } from "./lib/metrics.js";
import { reservationsLogger } from "./logger.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerReservationCommandRoutes } from "./routes/reservation-commands.js";

export const buildServer = () => {
  const app = fastify({
    loggerInstance: reservationsLogger as FastifyBaseLogger,
  });

  app.register(fastifyHelmet, { global: true });
  app.register(fastifySensible);
  app.register(swaggerPlugin);

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
      await Promise.all([
        checkDatabaseHealth(),
        checkKafkaHealth(),
        checkLifecycleGuardHealth(),
      ]);
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

  app.get("/health/lifecycle", async (_request, reply) => {
    try {
      const summary: LifecycleHealthSummary = await getLifecycleHealthSummary();
      if (summary.stalled.length > 0) {
        void reply.code(503);
        return {
          status: "stalled",
          service: serviceConfig.serviceId,
          thresholdMs: summary.thresholdMs,
          stalled: summary.stalled,
        };
      }
      return {
        status: "healthy",
        service: serviceConfig.serviceId,
        thresholdMs: summary.thresholdMs,
        states: summary.states,
      };
    } catch (error) {
      app.log.error(error, "Lifecycle guard health check failed");
      void reply.code(500);
      return {
        status: "error",
        service: serviceConfig.serviceId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  registerReservationCommandRoutes(app);

  return app;
};
